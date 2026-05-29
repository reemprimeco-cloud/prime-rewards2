import { Express, Request, Response } from "express";
import { processQbPaymentEvent } from "./qbRewardsEngine";
import { lookupQBInvoice, fetchQBCustomer } from "./quickbooks";
import crypto from "crypto";

/**
 * Validate Intuit webhook signature.
 * Intuit signs the raw body with HMAC-SHA256 using the verifier token as the key.
 * The result is base64-encoded and sent in the "intuit-signature" header.
 */
function validateQBWebhookSignature(req: Request): boolean {
  const verificationToken = process.env.QB_WEBHOOK_VERIFICATION_TOKEN;

  if (!verificationToken) {
    console.error("[QB Webhook] ❌ QB_WEBHOOK_VERIFICATION_TOKEN not set — rejecting webhook");
    return false;
  }

  const signature = req.headers["intuit-signature"] as string | undefined;
  if (!signature) {
    console.error("[QB Webhook] ❌ Missing intuit-signature header — rejecting webhook");
    return false;
  }

  // rawBody is populated by the express.json verify callback in _core/index.ts
  const rawBody: string = (req as any).rawBody ?? JSON.stringify(req.body);

  const expected = crypto
    .createHmac("sha256", verificationToken)
    .update(rawBody)
    .digest("base64");

  if (expected !== signature) {
    console.error("[QB Webhook] ❌ Signature mismatch");
    console.error(`[QB Webhook]   Expected : ${expected}`);
    console.error(`[QB Webhook]   Received : ${signature}`);
    return false;
  }

  console.log("[QB Webhook] ✅ Signature valid");
  return true;
}

export function registerQbWebhookReceiver(app: Express) {
  /**
   * POST /api/qb/webhook
   * Receives Payment / Invoice Paid events from QuickBooks.
   *
   * CRITICAL: This endpoint MUST return HTTP 200 immediately.
   * All heavy processing (invoice lookup, customer fetch, Twilio send) happens async in background.
   *
   * Real QB payload shape:
   * {
   *   "eventNotifications": [{
   *     "realmId": "...",
   *     "dataChangeEvent": {
   *       "entities": [{ "name": "Invoice", "id": "123", "operation": "Update", "lastUpdated": "..." }]
   *     }
   *   }]
   * }
   */
  app.post("/api/qb/webhook", async (req: Request, res: Response) => {
    const ts = new Date().toISOString();
    console.log(`\n[QB Webhook] ═══════════════════════════════════════════`);
    console.log(`[QB Webhook] 🚀 RECEIVED  ${ts}`);
    console.log(`[QB Webhook] Headers: ${JSON.stringify(req.headers, null, 2)}`);
    console.log(`[QB Webhook] Body: ${JSON.stringify(req.body, null, 2)}`);
    console.log(`[QB Webhook] ═══════════════════════════════════════════`);

    // ✅ CRITICAL: Always respond 200 immediately so Intuit doesn't retry or mark as failed
    // Do NOT wait for processing — move all heavy work to async background
    console.log("[QB Webhook] 📤 Responding HTTP 200 OK immediately");
    res.status(200).json({ received: true });

    // ✅ Process webhook asynchronously in background (fire-and-forget)
    // This prevents blocking the HTTP response and allows Intuit to consider delivery successful
    (async () => {
      try {
        console.log("[QB Webhook] ⏳ Async processing started");

        // ── Step 1: Signature ──────────────────────────────────────────────
        if (!validateQBWebhookSignature(req)) {
          console.error("[QB Webhook] ❌ Signature validation failed — aborting async processing");
          return;
        }

        // ── Step 2: Parse payload ──────────────────────────────────────────
        const body = req.body as any;

        // Support both legacy flat format and real QB eventNotifications format
        let notifications: any[] = [];

        if (Array.isArray(body?.eventNotifications)) {
          // Real QB format
          notifications = body.eventNotifications;
          console.log(`[QB Webhook] 📋 Real QB format — ${notifications.length} notification(s)`);
        } else if (Array.isArray(body?.entities)) {
          // Legacy / test format
          notifications = [{
            realmId: body.realmId ?? "unknown",
            dataChangeEvent: { entities: body.entities }
          }];
          console.log(`[QB Webhook] 📋 Legacy format — wrapped into 1 notification`);
        } else {
          console.warn("[QB Webhook] ⚠️  Unrecognised payload shape — nothing to process");
          console.warn("[QB Webhook] Body keys:", Object.keys(body ?? {}));
          return;
        }

        // ── Step 3: Process each notification ─────────────────────────
        for (const notification of notifications) {
          const realmId = notification.realmId;
          const entities: any[] = notification?.dataChangeEvent?.entities ?? [];

          console.log(`\n[QB Webhook] 🏢 Realm: ${realmId}  |  Entities: ${entities.length}`);

          for (const entity of entities) {
            console.log(`\n[QB Webhook] ── Entity: name=${entity.name}  id=${entity.id}  op=${entity.operation}`);

            // QB sends payment events as Payment, Invoice, or SalesReceipt.
            // Previously only Invoice was handled — Payment and SalesReceipt were silently skipped.
            if (entity.name === "Invoice") {
              await processInvoiceEntity(entity.id, realmId);
            } else if (entity.name === "Payment") {
              console.log(`[QB Webhook]   💳 Payment entity — resolving linked invoice`);
              await processPaymentEntity(entity.id, realmId);
            } else if (entity.name === "SalesReceipt") {
              console.log(`[QB Webhook]   🧾 SalesReceipt entity — processing directly`);
              await processSalesReceiptEntity(entity.id, realmId);
            } else {
              console.log(`[QB Webhook]   ⏭️  Skipping unrelated entity type: ${entity.name}`);
            }
          }
        }

        console.log(`[QB Webhook] ✅ Async processing complete\n`);

      } catch (err: any) {
        console.error("[QB Webhook] ❌ Async processing failed:", err?.message);
        console.error("[QB Webhook] Stack:", err?.stack);
      }
    })(); // Fire-and-forget: do not await this
  });

  /**
   * POST /api/qb/test-webhook
   * Manual test endpoint — bypasses signature check.
   */
  app.post("/api/qb/test-webhook", async (req: Request, res: Response) => {
    try {
      const { qbInvoiceId, invoiceNumber, customerPhone, customerName, amount } = req.body;

      if (!qbInvoiceId || !invoiceNumber || !customerPhone || !amount) {
        return res.status(400).json({ error: "Missing required fields: qbInvoiceId, invoiceNumber, customerPhone, amount" });
      }

      console.log(`[QB Test] Manual trigger: invoice=${invoiceNumber} customer=${customerName} phone=${customerPhone} amount=${amount}`);

      const result = await processQbPaymentEvent({
        qbInvoiceId,
        invoiceNumber,
        customerPhone,
        customerName,
        amount: parseFloat(amount),
      });

      res.json(result);
    } catch (error: any) {
      console.error("[QB Test Webhook] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });
}

/**
 * Fetch invoice from QB, verify it's paid, fetch customer, trigger rewards + WhatsApp.
 */
async function processInvoiceEntity(invoiceId: string, realmId: string) {
  console.log(`\n[QB Webhook] 🔍 Fetching invoice ${invoiceId} from QB API (realm: ${realmId})`);

  try {
    // ── Fetch invoice ────────────────────────────────────────────────────
    const lookupResult = await lookupQBInvoice(invoiceId);

    if (!lookupResult.found || !lookupResult.invoice) {
      console.error(`[QB Webhook] ❌ Invoice ${invoiceId} not found in QB`);
      return;
    }

    const invoice = lookupResult.invoice;
    console.log(`[QB Webhook] ✅ Invoice fetched:`);
    console.log(`[QB Webhook]   DocNumber   : ${invoice.DocNumber}`);
    console.log(`[QB Webhook]   TotalAmt    : ${invoice.TotalAmt}`);
    console.log(`[QB Webhook]   Balance     : ${invoice.Balance}`);
    console.log(`[QB Webhook]   Status      : ${lookupResult.status}`);
    console.log(`[QB Webhook]   CustomerRef : ${JSON.stringify(invoice.CustomerRef)}`);

    // ── Check payment status ─────────────────────────────────────────────
    if (lookupResult.status !== "paid") {
      console.log(`[QB Webhook] ⏭️  Invoice ${invoice.DocNumber} is not paid (status: ${lookupResult.status}) — skipping`);
      return;
    }

    console.log(`[QB Webhook] 💳 Invoice is PAID — proceeding`);

    // ── Extract invoice details ──────────────────────────────────────────
    const customerId = invoice.CustomerRef?.value;
    const invoiceNumber = invoice.DocNumber;
    const amount = invoice.TotalAmt;

    if (!customerId) {
      console.error(`[QB Webhook] ❌ Invoice ${invoiceNumber} has no CustomerRef.value — cannot fetch customer`);
      return;
    }

    // ── Fetch customer ───────────────────────────────────────────────────
    console.log(`\n[QB Webhook] 👤 Fetching customer ${customerId} from QB API`);
    const customer = await fetchQBCustomer(customerId);

    if (!customer) {
      console.error(`[QB Webhook] ❌ Customer ${customerId} not found in QB`);
      return;
    }

    console.log(`[QB Webhook] ✅ Customer fetched:`);
    console.log(`[QB Webhook]   DisplayName  : ${customer.DisplayName}`);
    console.log(`[QB Webhook]   Mobile       : ${customer.Mobile}`);
    console.log(`[QB Webhook]   PrimaryPhone : ${customer.PrimaryPhone}`);
    console.log(`[QB Webhook]   Full object  : ${JSON.stringify(customer, null, 2)}`);

    // ── Extract phone — ONLY real QB fields, no fallback ─────────────────
    const rawPhone = (customer.Mobile || customer.PrimaryPhone) as string | undefined;

    if (!rawPhone) {
      console.error(`[QB Webhook] ❌ No phone number for customer "${customer.DisplayName}" (id: ${customerId})`);
      console.error(`[QB Webhook]   Mobile field       : ${customer.Mobile}`);
      console.error(`[QB Webhook]   PrimaryPhone field : ${customer.PrimaryPhone}`);
      console.error(`[QB Webhook]   Action: ABORTING — will not send WhatsApp without real phone`);
      return;
    }

    const customerName = customer.DisplayName;
    console.log(`\n[QB Webhook] 📞 Phone extracted:`);
    console.log(`[QB Webhook]   Raw phone  : ${rawPhone}`);
    console.log(`[QB Webhook]   Customer   : ${customerName}`);
    console.log(`[QB Webhook]   Invoice    : ${invoiceNumber}`);
    console.log(`[QB Webhook]   Amount     : ${amount}`);

    // ── Trigger rewards engine ───────────────────────────────────────────
    console.log(`\n[QB Webhook] 🎯 Triggering rewards engine`);

    const result = await processQbPaymentEvent({
      qbInvoiceId: invoiceId,
      invoiceNumber,
      customerPhone: rawPhone,
      customerName,
      amount,
    });

    console.log(`[QB Webhook] Rewards result: ${JSON.stringify(result, null, 2)}`);

    if (result.status === "success") {
      if ("pointsAdded" in result) {
        console.log(`[QB Webhook] ✅ Points added: ${result.pointsAdded} → customer ${result.customerId}`);
      } else if ("pointsPending" in result) {
        console.log(`[QB Webhook] ⏳ Points pending (customer not registered): ${result.pointsPending}`);
      }
      console.log(`[QB Webhook] 📤 WhatsApp template sent to: ${rawPhone}`);
    } else {
      console.error(`[QB Webhook] ❌ Rewards processing failed: ${result.error}`);
    }

  } catch (err: any) {
    console.error(`[QB Webhook] ❌ Error processing invoice ${invoiceId}:`, err?.message);
    console.error(`[QB Webhook] Stack:`, err?.stack);
  }
}

/**
 * Handle a QB Payment entity.
 * A Payment in QB links to one or more invoices via Line[].LinkedTxn[].
 * We fetch the payment, resolve every linked Invoice, then process each paid one.
 */
async function processPaymentEntity(paymentId: string, realmId: string) {
  console.log(`\n[QB Webhook] 💳 Fetching Payment ${paymentId} from QB API (realm: ${realmId})`);
  try {
    const { getValidAccessToken, getQBRealmId } = await import("./quickbooks");
    const { ENV } = await import("./_core/env");

    const accessToken = await getValidAccessToken();
    const resolvedRealmId = await getQBRealmId();
    const baseUrl =
      ENV.qbEnvironment === "production"
        ? "https://quickbooks.api.intuit.com"
        : "https://sandbox-quickbooks.api.intuit.com";

    const safeId = paymentId.replace(/['"\\]/g, "");
    const url = `${baseUrl}/v3/company/${resolvedRealmId}/payment/${safeId}?minorversion=65`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`[QB Webhook] ❌ Payment ${paymentId} fetch failed: HTTP ${res.status}`);
      return;
    }

    const data = await res.json();
    const payment = data?.Payment ?? data;
    console.log(`[QB Webhook] ✅ Payment fetched: TotalAmt=${payment.TotalAmt}  CustomerRef=${JSON.stringify(payment.CustomerRef)}`);
    console.log(`[QB Webhook]   Full Payment object: ${JSON.stringify(data, null, 2)}`);

    // Extract linked Invoice IDs from Line[].LinkedTxn[]
    const linkedInvoiceIds: string[] = [];
    const lines: any[] = payment.Line ?? [];
    for (const line of lines) {
      const linked: any[] = line.LinkedTxn ?? [];
      for (const txn of linked) {
        if (txn.TxnType === "Invoice") {
          linkedInvoiceIds.push(txn.TxnId);
          console.log(`[QB Webhook]   🔗 Linked Invoice: ${txn.TxnId}`);
        }
      }
    }

    if (linkedInvoiceIds.length === 0) {
      console.warn(`[QB Webhook] ⚠️  Payment ${paymentId} has no linked invoices — skipping`);
      return;
    }

    for (const invoiceId of linkedInvoiceIds) {
      console.log(`[QB Webhook]   ↳ Processing linked Invoice ${invoiceId}`);
      await processInvoiceEntity(invoiceId, realmId);
    }
  } catch (err: any) {
    console.error(`[QB Webhook] ❌ Error processing Payment ${paymentId}:`, err?.message);
    console.error(`[QB Webhook] Stack:`, err?.stack);
  }
}

/**
 * Handle a QB SalesReceipt entity.
 * SalesReceipts are self-contained paid transactions (no separate payment step).
 * We fetch the receipt, extract CustomerRef + TotalAmt, and trigger rewards directly.
 */
async function processSalesReceiptEntity(receiptId: string, realmId: string) {
  console.log(`\n[QB Webhook] 🧾 Fetching SalesReceipt ${receiptId} from QB API (realm: ${realmId})`);
  try {
    const { getValidAccessToken, getQBRealmId, fetchQBCustomer } = await import("./quickbooks");
    const { ENV } = await import("./_core/env");

    const accessToken = await getValidAccessToken();
    const resolvedRealmId = await getQBRealmId();
    const baseUrl =
      ENV.qbEnvironment === "production"
        ? "https://quickbooks.api.intuit.com"
        : "https://sandbox-quickbooks.api.intuit.com";

    const safeId = receiptId.replace(/['"\\]/g, "");
    const url = `${baseUrl}/v3/company/${resolvedRealmId}/salesreceipt/${safeId}?minorversion=65`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`[QB Webhook] ❌ SalesReceipt ${receiptId} fetch failed: HTTP ${res.status}`);
      return;
    }

    const data = await res.json();
    const receipt = data?.SalesReceipt ?? data;
    console.log(`[QB Webhook] ✅ SalesReceipt fetched:`);
    console.log(`[QB Webhook]   DocNumber   : ${receipt.DocNumber}`);
    console.log(`[QB Webhook]   TotalAmt    : ${receipt.TotalAmt}`);
    console.log(`[QB Webhook]   CustomerRef : ${JSON.stringify(receipt.CustomerRef)}`);
    console.log(`[QB Webhook]   Full object : ${JSON.stringify(data, null, 2)}`);

    const customerId = receipt.CustomerRef?.value;
    if (!customerId) {
      console.error(`[QB Webhook] ❌ SalesReceipt ${receiptId} has no CustomerRef.value`);
      return;
    }

    const customer = await fetchQBCustomer(customerId);
    if (!customer) {
      console.error(`[QB Webhook] ❌ Customer ${customerId} not found for SalesReceipt ${receiptId}`);
      return;
    }

    const rawPhone = (customer.Mobile || customer.PrimaryPhone) as string | undefined;
    if (!rawPhone) {
      console.error(`[QB Webhook] ❌ No phone for customer "${customer.DisplayName}" — aborting`);
      return;
    }

    console.log(`[QB Webhook] 🎯 Triggering rewards engine for SalesReceipt ${receiptId}`);
    const result = await processQbPaymentEvent({
      qbInvoiceId: `SR-${receiptId}`,
      invoiceNumber: receipt.DocNumber ?? receiptId,
      customerPhone: rawPhone,
      customerName: customer.DisplayName,
      amount: receipt.TotalAmt,
    });

    console.log(`[QB Webhook] SalesReceipt rewards result: ${JSON.stringify(result, null, 2)}`);
  } catch (err: any) {
    console.error(`[QB Webhook] ❌ Error processing SalesReceipt ${receiptId}:`, err?.message);
    console.error(`[QB Webhook] Stack:`, err?.stack);
  }
}
