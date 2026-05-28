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
      console.log("\n[QB Webhook] ════════════════════════════════════════════════════════");
      console.log("[QB Webhook] 🚀 WEBHOOK EXECUTION STARTED");
      console.log("[QB Webhook] ════════════════════════════════════════════════════════");
      console.log("[QB Webhook] Received at:", new Date().toISOString());

      // STEP 0: Log full payload
      console.log("\n[QB Webhook] 📥 STEP 0: Webhook Payload Received");
      console.log("[QB Webhook] Full Payload:", JSON.stringify(req.body, null, 2));

      // STEP 1: Validate webhook signature
      console.log("\n[QB Webhook] 🔐 STEP 1: Validate Webhook Signature");
      const isValidSignature = validateQBWebhookSignature(req);
      if (!isValidSignature) {
        console.error("[QB Webhook] ❌ SIGNATURE VALIDATION FAILED - REJECTING WEBHOOK");
        return res.status(401).json({ error: "Invalid signature" });
      }
      console.log("[QB Webhook] ✅ Signature validated successfully");

      // Acknowledge receipt immediately (HTTP 200)
      res.status(200).json({ status: "received" });

      // STEP 2: Parse QB event
      console.log("\n[QB Webhook] 📋 STEP 2: Parse Event Type and Entities");
      const eventType = req.body.eventType;
      const entities = req.body.entities || [];
      const webhookEventId = req.body.id;

      console.log(`[QB Webhook]   - Event Type: ${eventType}`);
      console.log(`[QB Webhook]   - Event ID: ${webhookEventId}`);
      console.log(`[QB Webhook]   - Total Entities: ${entities.length}`);

      // STEP 3: Check event type support
      console.log("\n[QB Webhook] 🔍 STEP 3: Check Event Type Support");
      if (eventType !== "Invoice.Change") {
        console.log(`[QB Webhook] ⏭️ UNSUPPORTED EVENT TYPE: "${eventType}"`);
        console.log(`[QB Webhook]   Supported types: Invoice.Change, Payment.Change, SalesReceipt.Change`);
        console.log(`[QB Webhook]   Action: Skipping webhook processing`);
        return;
      }
      console.log(`[QB Webhook] ✅ Event type "${eventType}" is supported`);

      // STEP 4: Process entities
      console.log(`\n[QB Webhook] 🔄 STEP 4: Process ${entities.length} Entities`);
      
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        console.log(`\n[QB Webhook] ┌─ Entity ${i + 1}/${entities.length}`);
        console.log(`[QB Webhook] │  Entity Type: ${entity.name}`);
        console.log(`[QB Webhook] │  Entity ID: ${entity.id}`);
        console.log(`[QB Webhook] │  Full Entity: ${JSON.stringify(entity, null, 2)}`);

        // Only process Invoice entities
        if (entity.name !== "Invoice") {
          console.log(`[QB Webhook] │  ⏭️ SKIPPING: Not an Invoice entity (type: ${entity.name})`);
          console.log(`[QB Webhook] └─ Entity ${i + 1} skipped`);
          continue;
        }

        console.log(`[QB Webhook] │  ✅ Invoice entity detected`);

        try {
          // STEP 5: Fetch invoice from QB API
          console.log(`[QB Webhook] │\n[QB Webhook] │  🔍 STEP 5: Fetch Invoice from QB API`);
          console.log(`[QB Webhook] │    Invoice ID: ${entity.id}`);
          
          const lookupResult = await lookupQBInvoice(entity.id);
          
          if (!lookupResult.found || !lookupResult.invoice) {
            console.error(`[QB Webhook] │    ❌ INVOICE NOT FOUND in QB`);
            console.error(`[QB Webhook] │    Invoice ID: ${entity.id}`);
            console.log(`[QB Webhook] └─ Entity ${i + 1} skipped (invoice not found)`);
            continue;
          }

          const invoice = lookupResult.invoice;
          console.log(`[QB Webhook] │    ✅ Invoice fetched successfully`);
          console.log(`[QB Webhook] │    - Invoice Number: ${invoice.DocNumber}`);
          console.log(`[QB Webhook] │    - Total Amount: ${invoice.TotalAmt}`);
          console.log(`[QB Webhook] │    - Balance: ${invoice.Balance}`);
          console.log(`[QB Webhook] │    - Status: ${lookupResult.status}`);
          console.log(`[QB Webhook] │    - Customer Ref: ${JSON.stringify(invoice.CustomerRef)}`);

          // STEP 6: Check payment status
          console.log(`[QB Webhook] │\n[QB Webhook] │  💳 STEP 6: Check Payment Status`);
          console.log(`[QB Webhook] │    Status: ${lookupResult.status}`);
          
          if (lookupResult.status !== "paid") {
            console.log(`[QB Webhook] │    ⏭️ INVOICE NOT PAID - SKIPPING`);
            console.log(`[QB Webhook] │    Expected: paid, Got: ${lookupResult.status}`);
            console.log(`[QB Webhook] └─ Entity ${i + 1} skipped (not paid)`);
            continue;
          }

          console.log(`[QB Webhook] │    ✅ Invoice is PAID - proceeding with payment processing`);

          // STEP 7: Extract invoice details
          console.log(`[QB Webhook] │\n[QB Webhook] │  📄 STEP 7: Extract Invoice Details`);
          const customerId = invoice.CustomerRef?.value;
          const invoiceNumber = invoice.DocNumber;
          const amount = invoice.TotalAmt;

          console.log(`[QB Webhook] │    - Customer ID: ${customerId}`);
          console.log(`[QB Webhook] │    - Invoice Number: ${invoiceNumber}`);
          console.log(`[QB Webhook] │    - Amount: ${amount}`);

          // STEP 8: Fetch customer from QB
          console.log(`[QB Webhook] │\n[QB Webhook] │  👤 STEP 8: Fetch Customer from QB API`);
          console.log(`[QB Webhook] │    Customer ID: ${customerId}`);
          
          const customer = await fetchQBCustomer(customerId);
          
          if (!customer) {
            console.error(`[QB Webhook] │    ❌ CUSTOMER NOT FOUND in QB`);
            console.error(`[QB Webhook] │    Customer ID: ${customerId}`);
            console.log(`[QB Webhook] └─ Entity ${i + 1} skipped (customer not found)`);
            continue;
          }

          console.log(`[QB Webhook] │    ✅ Customer fetched successfully`);
          console.log(`[QB Webhook] │    - Display Name: ${customer.DisplayName}`);
          console.log(`[QB Webhook] │    - Mobile: ${customer.Mobile}`);
          console.log(`[QB Webhook] │    - Primary Phone: ${customer.PrimaryPhone}`);

          // STEP 9: Extract mobile phone
          console.log(`[QB Webhook] │\n[QB Webhook] │  📞 STEP 9: Extract Mobile Phone`);
          const customerPhone = customer.Mobile || customer.PrimaryPhone;
          
          if (!customerPhone) {
            console.error(`[QB Webhook] │    ❌ NO PHONE NUMBER FOUND`);
            console.error(`[QB Webhook] │    Customer: ${customer.DisplayName}`);
            console.error(`[QB Webhook] │    Customer ID: ${customerId}`);
            console.error(`[QB Webhook] │    Mobile field: ${customer.Mobile}`);
            console.error(`[QB Webhook] │    PrimaryPhone field: ${customer.PrimaryPhone}`);
            console.log(`[QB Webhook] │    Action: ABORTING - Cannot send WhatsApp without phone`);
            console.log(`[QB Webhook] └─ Entity ${i + 1} skipped (no phone)`);
            continue;
          }

          const customerName = customer.DisplayName;
          const normalizedPhone = customerPhone.replace(/\D/g, "");

          console.log(`[QB Webhook] │    ✅ Phone extracted successfully`);
          console.log(`[QB Webhook] │    - Raw Phone: ${customerPhone}`);
          console.log(`[QB Webhook] │    - Normalized: +${normalizedPhone}`);
          console.log(`[QB Webhook] │    - Twilio Destination: whatsapp:+${normalizedPhone}`);

          // STEP 10: Trigger rewards engine
          console.log(`[QB Webhook] │\n[QB Webhook] │  🎯 STEP 10: Trigger Rewards Engine`);
          console.log(`[QB Webhook] │    Customer: ${customerName}`);
          console.log(`[QB Webhook] │    Phone: +${normalizedPhone}`);
          console.log(`[QB Webhook] │    Invoice: ${invoiceNumber}`);
          console.log(`[QB Webhook] │    Amount: ${amount}`);
          
          const result = await processQbPaymentEvent({
            qbInvoiceId: entity.id,
            invoiceNumber,
            customerPhone,
            customerName,
            amount,
            webhookEventId,
          });

          console.log(`[QB Webhook] │    Rewards Engine Result:`, JSON.stringify(result, null, 2));

          // STEP 11: Check rewards result
          console.log(`[QB Webhook] │\n[QB Webhook] │  🎁 STEP 11: Process Rewards Result`);
          
          if (result.status === "success") {
            console.log(`[QB Webhook] │    ✅ PAYMENT PROCESSED SUCCESSFULLY`);
            if ("pointsAdded" in result) {
              console.log(`[QB Webhook] │    - Points Added: ${result.pointsAdded}`);
              console.log(`[QB Webhook] │    - Customer ID: ${result.customerId}`);
              console.log(`[QB Webhook] │    - WhatsApp Sent: Yes`);
            } else if ("pointsPending" in result) {
              console.log(`[QB Webhook] │    - Points Pending: ${result.pointsPending}`);
              console.log(`[QB Webhook] │    - Pending Reward ID: ${result.pendingRewardId}`);
              console.log(`[QB Webhook] │    - Reason: Customer not registered yet`);
            }
          } else {
            console.error(`[QB Webhook] │    ❌ PAYMENT PROCESSING FAILED`);
            console.error(`[QB Webhook] │    Error: ${result.error}`);
          }

          // STEP 12: Twilio send confirmation
          console.log(`[QB Webhook] │\n[QB Webhook] │  📤 STEP 12: Twilio Send Confirmation`);
          if (result.status === "success") {
            console.log(`[QB Webhook] │    ✅ WhatsApp template sent to whatsapp:+${normalizedPhone}`);
            console.log(`[QB Webhook] │    - ContentSid: reward_test`);
            console.log(`[QB Webhook] │    - Destination: +${normalizedPhone}`);
            console.log(`[QB Webhook] │    - Customer: ${customerName}`);
          } else {
            console.error(`[QB Webhook] │    ❌ WhatsApp send failed or pending`);
          }

          console.log(`[QB Webhook] └─ Entity ${i + 1} processed successfully\n`);

        } catch (entityErr: any) {
          console.error(`[QB Webhook] │  ❌ EXCEPTION DURING ENTITY PROCESSING`);
          console.error(`[QB Webhook] │  Entity ID: ${entity.id}`);
          console.error(`[QB Webhook] │  Error Message: ${entityErr?.message}`);
          console.error(`[QB Webhook] │  Stack Trace:`, entityErr?.stack);
          console.log(`[QB Webhook] └─ Entity ${i + 1} failed with exception\n`);
        }
      }

      console.log("[QB Webhook] ════════════════════════════════════════════════════════");
      console.log("[QB Webhook] ✅ WEBHOOK EXECUTION COMPLETED");
      console.log("[QB Webhook] ════════════════════════════════════════════════════════\n");

    } catch (error: any) {
      console.error("[QB Webhook] ════════════════════════════════════════════════════════");
      console.error("[QB Webhook] ❌ CRITICAL WEBHOOK ERROR");
      console.error("[QB Webhook] ════════════════════════════════════════════════════════");
      console.error("[QB Webhook] Error Message:", error?.message);
      console.error("[QB Webhook] Stack Trace:", error?.stack);
      console.error("[QB Webhook] ════════════════════════════════════════════════════════\n");
      
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
