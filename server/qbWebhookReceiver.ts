import type { Express, Request, Response } from "express";
import { processQbPaymentEvent } from "./qbRewardsEngine";
import { lookupQBInvoice, fetchQBCustomer } from "./quickbooks";
import crypto from "crypto";

// Webhook signature validation using Intuit's verification token
function validateQBWebhookSignature(req: Request): boolean {
  try {
    // Get the signature from the header
    const signature = req.headers["intuit-signature"] as string;
    if (!signature) {
      console.warn("[QB Webhook] Missing intuit-signature header");
      return false;
    }

    // Get the webhook verification token from environment
    const verificationToken = process.env.QB_WEBHOOK_VERIFICATION_TOKEN;
    if (!verificationToken) {
      console.warn("[QB Webhook] QB_WEBHOOK_VERIFICATION_TOKEN not configured");
      return false;
    }

    // Get the raw request body
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    
    // Create the hash: HMAC-SHA256 of (body + token)
    const hash = crypto
      .createHmac("sha256", verificationToken)
      .update(rawBody)
      .digest("base64");

    // Compare signatures
    const isValid = hash === signature;
    if (!isValid) {
      console.warn("[QB Webhook] Signature validation failed");
      console.warn("[QB Webhook] Expected:", hash);
      console.warn("[QB Webhook] Got:", signature);
    }
    return isValid;
  } catch (err) {
    console.error("[QB Webhook] Signature validation error:", err);
    return false;
  }
}

export function registerQbWebhookReceiver(app: Express) {
  /**
   * POST /api/qb/webhook - Production QB webhook endpoint
   * Receives Payment/Invoice Paid events from QuickBooks
   * Validates signature, processes payment, triggers rewards, sends WhatsApp
   */
  app.post("/api/qb/webhook", async (req: Request, res: Response) => {
    try {
      console.log("[QB Webhook] ========================================");
      console.log("[QB Webhook] Webhook received at:", new Date().toISOString());
      console.log("[QB Webhook] Event ID:", req.body.id);
      console.log("[QB Webhook] Event Type:", req.body.eventType);

      // Validate webhook signature
      const isValidSignature = validateQBWebhookSignature(req);
      if (!isValidSignature) {
        console.error("[QB Webhook] ❌ SIGNATURE VALIDATION FAILED");
        return res.status(401).json({ error: "Invalid signature" });
      }
      console.log("[QB Webhook] ✅ Signature validated");

      // Acknowledge receipt immediately (HTTP 200)
      res.status(200).json({ status: "received" });

      // Parse QB event
      const eventType = req.body.eventType;
      const entities = req.body.entities || [];
      const webhookEventId = req.body.id;

      // Only process Invoice.Change events
      if (eventType !== "Invoice.Change") {
        console.log(`[QB Webhook] Ignoring event type: ${eventType}`);
        return;
      }

      console.log(`[QB Webhook] Processing ${entities.length} entities`);

      // Process each invoice entity
      for (const entity of entities) {
        if (entity.name === "Invoice") {
          try {
            console.log(`[QB Webhook] 📋 Processing invoice ID: ${entity.id}`);

            // Fetch full invoice details from QB API
            const lookupResult = await lookupQBInvoice(entity.id);
            
            if (!lookupResult.found || !lookupResult.invoice) {
              console.warn(`[QB Webhook] ⚠️ Invoice not found: ${entity.id}`);
              continue;
            }

            const invoice = lookupResult.invoice;
            console.log(`[QB Webhook] 📄 Invoice Number: ${invoice.DocNumber}`);
            console.log(`[QB Webhook] 💰 Amount: ${invoice.TotalAmt}`);
            console.log(`[QB Webhook] 💳 Balance: ${invoice.Balance}`);
            console.log(`[QB Webhook] 👤 Customer: ${invoice.CustomerRef?.name}`);

            // Only process PAID invoices (Balance = 0)
            if (lookupResult.status !== "paid") {
              console.log(`[QB Webhook] ⏭️ Invoice not paid yet (status: ${lookupResult.status}), skipping`);
              continue;
            }

            console.log(`[QB Webhook] ✅ Invoice is PAID - processing payment`);

            // Extract invoice details
            const customerId = invoice.CustomerRef?.value;
            const invoiceNumber = invoice.DocNumber;
            const amount = invoice.TotalAmt;

            // Fetch REAL customer data from QB (including mobile phone)
            console.log(`[QB Webhook] 📞 Fetching real customer data from QB...`);
            const customer = await fetchQBCustomer(customerId);
            
            if (!customer) {
              console.error(`[QB Webhook] ❌ Could not fetch customer details for ID: ${customerId}`);
              continue;
            }

            // Use REAL customer mobile phone (not fallback)
            const customerPhone = customer.Mobile || customer.PrimaryPhone;
            if (!customerPhone) {
              console.error(`[QB Webhook] ❌ Customer has no mobile or primary phone number`);
              console.error(`[QB Webhook]   Customer ID: ${customerId}`);
              console.error(`[QB Webhook]   Customer Name: ${customer.DisplayName}`);
              continue;
            }

            const customerName = customer.DisplayName;

            console.log(`[QB Webhook] ✅ Real QB Customer Data:`);
            console.log(`[QB Webhook]   - QB Customer Name: ${customerName}`);
            console.log(`[QB Webhook]   - QB Mobile: ${customerPhone}`);
            console.log(`[QB Webhook]   - Invoice Number: ${invoiceNumber}`);
            console.log(`[QB Webhook]   - Amount: ${amount} KD`);
            console.log(`[QB Webhook]   - Twilio Destination: whatsapp:+${customerPhone.replace(/\D/g, "")}`);

            // Trigger rewards engine (processes payment, calculates points, sends WhatsApp)
            console.log(`[QB Webhook] 🎯 Triggering rewards engine...`);
            const result = await processQbPaymentEvent({
              qbInvoiceId: entity.id,
              invoiceNumber,
              customerPhone,
              customerName,
              amount,
              webhookEventId,
            });

            console.log(`[QB Webhook] 🎁 Rewards Engine Result:`, JSON.stringify(result, null, 2));

            if (result.status === "success") {
              console.log(`[QB Webhook] ✅ PAYMENT PROCESSED SUCCESSFULLY`);
              if ("pointsAdded" in result) {
                console.log(`[QB Webhook]   - Points Added: ${result.pointsAdded}`);
                console.log(`[QB Webhook]   - Customer ID: ${result.customerId}`);
              } else if ("pointsPending" in result) {
                console.log(`[QB Webhook]   - Points Pending: ${result.pointsPending}`);
                console.log(`[QB Webhook]   - Pending Reward ID: ${result.pendingRewardId}`);
              }
            } else {
              console.error(`[QB Webhook] ❌ PAYMENT PROCESSING FAILED:`, result.error);
            }
          } catch (entityErr: any) {
            console.error(`[QB Webhook] ❌ Error processing entity ${entity.id}:`, entityErr?.message);
          }
        }
      }

      console.log("[QB Webhook] ========================================\n");
    } catch (error: any) {
      console.error("[QB Webhook] ❌ WEBHOOK ERROR:", error?.message);
      console.error("[QB Webhook] Stack:", error?.stack);
      // Still return 200 to acknowledge to Intuit
      res.status(200).json({ status: "error", message: String(error) });
    }
  });

  /**
   * POST /api/qb/test-webhook - Test endpoint for manual testing
   */
  app.post("/api/qb/test-webhook", async (req: Request, res: Response) => {
    try {
      const { qbInvoiceId, invoiceNumber, customerPhone, customerName, amount } = req.body;

      if (!qbInvoiceId || !invoiceNumber || !customerPhone || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await processQbPaymentEvent({
        qbInvoiceId,
        invoiceNumber,
        customerPhone,
        customerName,
        amount: parseFloat(amount),
      });

      res.json(result);
    } catch (error) {
      console.error("[QB Test Webhook] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });
}
