import type { Express, Request, Response } from "express";
import twilio from "twilio";

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";

export function registerTwilioWebhookRoutes(app: Express) {
  // POST /api/twilio/whatsapp/webhook - Receive incoming WhatsApp messages
  app.post("/api/twilio/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      // Log incoming request
      console.log("[Twilio Webhook] Incoming request");
      console.log("[Twilio Webhook] Headers:", JSON.stringify(req.headers, null, 2));
      console.log("[Twilio Webhook] Body:", JSON.stringify(req.body, null, 2));

      // Verify Twilio signature
      const twilioSignature = req.headers["x-twilio-signature"] as string;
      const url = `${process.env.APP_BASE_URL || "https://primerewds.com"}/api/twilio/whatsapp/webhook`;
      
      const isValidRequest = twilio.validateRequest(
        TWILIO_AUTH_TOKEN,
        twilioSignature,
        url,
        req.body
      );

      if (!isValidRequest) {
        console.warn("[Twilio Webhook] Invalid signature");
        return res.status(403).send("Forbidden");
      }

      // Extract message data
      const from = req.body.From; // Incoming phone (whatsapp:+965XXXXXXXX)
      const body = req.body.Body; // Message text
      const messageSid = req.body.MessageSid; // Twilio message ID

      console.log(`[Twilio Webhook] Message received from ${from}`);
      console.log(`[Twilio Webhook] MessageSid: ${messageSid}`);
      console.log(`[Twilio Webhook] Body: ${body}`);

      // Build TwiML response (automatic reply)
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("Prime Rewards WhatsApp connected successfully. 💙\n\nWe received your message. Our team will respond shortly.");

      // Set response headers
      res.type("text/xml");
      res.status(200).send(twiml.toString());

      console.log("[Twilio Webhook] Response sent successfully");
    } catch (error) {
      console.error("[Twilio Webhook] Error:", error);
      // Still return 200 to acknowledge receipt
      res.type("text/xml");
      res.status(200).send(new twilio.twiml.MessagingResponse().toString());
    }
  });

  // POST /api/twilio/whatsapp/status - Receive message delivery status updates
  app.post("/api/twilio/whatsapp/status", async (req: Request, res: Response) => {
    try {
      console.log("[Twilio Status] Status update received");
      console.log("[Twilio Status] Full Response:", JSON.stringify(req.body, null, 2));

      const messageSid = req.body.MessageSid;
      const messageStatus = req.body.MessageStatus; // sent, delivered, failed, read, etc.
      const errorCode = req.body.ErrorCode;
      const errorMessage = req.body.ErrorMessage;

      console.log(`[Twilio Status] MessageSid: ${messageSid}, Status: ${messageStatus}, ErrorCode: ${errorCode}`);

      // Update whatsapp_logs with delivery status
      try {
        const { getDb } = await import("./db");
        const { whatsappLogs } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        const db = await getDb();
        if (db && messageSid) {
          // Map Twilio status to our status enum
          let logStatus = "sent";
          if (messageStatus === "failed" || messageStatus === "undelivered") {
            logStatus = "failed";
          }

          const updateData: any = {
            status: logStatus,
            sentAt: new Date(),
          };

          // Log error details if present
          if (errorCode || errorMessage) {
            updateData.errorMessage = `Twilio ${messageStatus}: ${errorCode || ""} - ${errorMessage || ""}`;
          }

          await db.update(whatsappLogs)
            .set(updateData)
            .where(eq(whatsappLogs.messageSid, messageSid));
          
          console.log(`[Twilio Status] Updated whatsapp_logs for ${messageSid}: ${logStatus}`);
        }
      } catch (dbError) {
        console.error("[Twilio Status] Failed to update database:", dbError);
      }

      // Acknowledge receipt
      res.status(200).send("OK");
    } catch (error) {
      console.error("[Twilio Status] Error:", error);
      res.status(200).send("OK");
    }
  });
}
