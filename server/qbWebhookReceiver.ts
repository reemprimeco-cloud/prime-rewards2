import type { Express, Request, Response } from "express";
import { processQbPaymentEvent } from "./qbRewardsEngine";

export function registerQbWebhookReceiver(app: Express) {
  /**
   * POST /api/qb/webhook - Receive QB payment events
   * QB sends: { eventType: "Invoice.Change", entities: [{ name: "Invoice", id: "..." }], ... }
   */
  app.post("/api/qb/webhook", async (req: Request, res: Response) => {
    try {
      console.log("[QB Webhook] Received event");
      console.log("[QB Webhook] Body:", JSON.stringify(req.body, null, 2));

      // Acknowledge receipt immediately
      res.status(200).send("OK");

      // Parse QB event
      const eventType = req.body.eventType;
      const entities = req.body.entities || [];

      // Only process Invoice.Change events
      if (eventType !== "Invoice.Change") {
        console.log(`[QB Webhook] Ignoring event type: ${eventType}`);
        return;
      }

      // Process each entity
      for (const entity of entities) {
        if (entity.name === "Invoice") {
          console.log(`[QB Webhook] Processing invoice: ${entity.id}`);
          
          // In a real scenario, you'd fetch the full invoice from QB API
          // For now, we'll extract what we can from the webhook
          // You'll need to implement QB API calls to get full invoice details
          
          // Example structure (you'd get this from QB API):
          // const invoice = await getQbInvoice(entity.id);
          // await processQbPaymentEvent({
          //   qbInvoiceId: invoice.id,
          //   invoiceNumber: invoice.docNumber,
          //   customerPhone: invoice.customerRef.value, // QB customer ID
          //   customerName: invoice.customerRef.name,
          //   amount: invoice.totalAmt,
          //   webhookEventId: req.body.id,
          // });
        }
      }
    } catch (error) {
      console.error("[QB Webhook] Error:", error);
      // Still return 200 to acknowledge
      res.status(200).send("OK");
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
