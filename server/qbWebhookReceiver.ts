import crypto from "crypto";
import { Express, Request, Response } from "express";
import { lookupQBInvoiceById, fetchQBCustomer, fetchQBPaymentLinkedInvoiceIds } from "./quickbooks";
import { processQbPaymentEvent } from "./qbRewardsEngine";

// NOTE: Signature validation requires the RAW request body. Your Express setup MUST
// capture it, e.g.:
//   app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf.toString(); } }));
// Without this, every real QB webhook fails signature validation and is silently dropped.

function validateSignature(req: Request): boolean {
  const token = process.env.QB_WEBHOOK_VERIFICATION_TOKEN;
  if (!token) {
    console.error("[QB Webhook] ❌ QB_WEBHOOK_VERIFICATION_TOKEN not set");
    return false;
  }
  const sig = req.headers["intuit-signature"] as string | undefined;
  if (!sig) {
    console.error("[QB Webhook] ❌ Missing intuit-signature header");
    return false;
  }
  const raw: string | undefined = (req as any).rawBody;
  if (!raw) {
    console.error(
      "[QB Webhook] ❌ rawBody not captured — signature cannot be verified. " +
      "Add to server setup: app.use(express.json({ verify: (req,_res,buf) => { (req as any).rawBody = buf.toString(); } }))"
    );
    return false;
  }
  const expected = crypto.createHmac("sha256", token).update(raw).digest("base64");
  if (expected !== sig) {
    console.error(`[QB Webhook] ❌ Signature mismatch  expected=${expected}  got=${sig}`);
    return false;
  }
  console.log("[QB Webhook] ✅ Signature valid");
  return true;
}

async function processInvoiceId(entityId: string, realmId: string): Promise<void> {
  console.log(`\n[QB Webhook] 🔍 Invoice id=${entityId}  realm=${realmId}`);

  const lookup = await lookupQBInvoiceById(entityId);
  if (!lookup.found || !lookup.invoice) {
    console.error(`[QB Webhook] ❌ Invoice ${entityId} not found — ${lookup.errorMessage ?? ""}`);
    return;
  }

  const inv = lookup.invoice;
  console.log(`[QB Webhook]   DocNumber=${inv.DocNumber}  TotalAmt=${inv.TotalAmt}  Balance=${inv.Balance}  status=${lookup.status}`);

  if (lookup.status !== "paid") {
    console.log(`[QB Webhook]   ⏭️  Not paid (${lookup.status}) — skipping`);
    return;
  }

  const customerId = inv.CustomerRef?.value;
  if (!customerId) {
    console.error(`[QB Webhook] ❌ Invoice ${inv.DocNumber} has no CustomerRef.value`);
    return;
  }

  const customer = await fetchQBCustomer(customerId);
  if (!customer) {
    console.error(`[QB Webhook] ❌ Customer ${customerId} not found`);
    return;
  }

  const rawPhone = (typeof customer.Mobile === "string" ? customer.Mobile : typeof customer.PrimaryPhone === "string" ? customer.PrimaryPhone : undefined);
  console.log(`[QB Webhook]   customer=${customer.DisplayName}  phone=${rawPhone}`);

  if (!rawPhone) {
    console.error(`[QB Webhook] ❌ No phone for "${customer.DisplayName}" — aborting`);
    return;
  }

  const result = await processQbPaymentEvent({
    qbInvoiceId:   entityId,
    invoiceNumber: inv.DocNumber,
    customerPhone: rawPhone,
    customerName:  customer.DisplayName,
    amount:        inv.TotalAmt,
  });

  console.log(`[QB Webhook] Result: ${JSON.stringify(result)}`);
}

async function processPaymentId(entityId: string, realmId: string): Promise<void> {
  console.log(`\n[QB Webhook] 💳 Payment id=${entityId}  realm=${realmId}`);
  const ids = await fetchQBPaymentLinkedInvoiceIds(entityId);
  if (ids.length === 0) {
    console.warn(`[QB Webhook] ⚠️  No linked invoices for payment ${entityId}`);
    return;
  }
  for (const id of ids) {
    await processInvoiceId(id, realmId);
  }
}

export function registerQbWebhookReceiver(app: Express): void {
  app.post("/api/qb/webhook", (req: Request, res: Response) => {
    console.log(`\n[QB Webhook] ═══ RECEIVED ${new Date().toISOString()} ═══`);
    console.log(`[QB Webhook] Body: ${JSON.stringify(req.body)}`);
    res.status(200).json({ received: true });

    setImmediate(async () => {
      try {
        if (!validateSignature(req)) return;

        const body = req.body as any;

        if (!Array.isArray(body?.eventNotifications)) {
          console.warn("[QB Webhook] ⚠️  Unrecognised payload — body keys:", Object.keys(body ?? {}));
          return;
        }

        for (const n of body.eventNotifications) {
          const realmId: string = n.realmId ?? "unknown";
          const entities: any[] = n?.dataChangeEvent?.entities ?? [];
          console.log(`\n[QB Webhook] realm=${realmId}  entities=${entities.length}`);

          for (const entity of entities) {
            console.log(`[QB Webhook]   name=${entity.name}  id=${entity.id}  op=${entity.operation}`);
            if      (entity.name === "Invoice") await processInvoiceId(entity.id, realmId);
            else if (entity.name === "Payment") await processPaymentId(entity.id, realmId);
            else console.log(`[QB Webhook]   ⏭️  Skipping: ${entity.name}`);
          }
        }
        console.log(`[QB Webhook] ✅ Done`);
      } catch (err: any) {
        console.error(`[QB Webhook] ❌ ${err?.message}`);
        console.error(err?.stack);
      }
    });
  });

  app.post("/api/qb/test-webhook", async (req: Request, res: Response) => {
    try {
      const { qbInvoiceId, invoiceNumber, customerPhone, customerName, amount } = req.body;
      if (!qbInvoiceId || !invoiceNumber || !customerPhone || !amount) {
        return res.status(400).json({ error: "Missing: qbInvoiceId, invoiceNumber, customerPhone, amount" });
      }
      const result = await processQbPaymentEvent({ qbInvoiceId, invoiceNumber, customerPhone, customerName, amount: parseFloat(amount) });
      res.json(result);
    } catch (err: any) {
      console.error("[QB Test Webhook]", err);
      res.status(500).json({ error: String(err) });
    }
  });
}
