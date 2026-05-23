import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";

/**
 * Validates Twilio credentials by calling the Twilio Account API.
 * This is a lightweight read-only check — it does NOT send any messages.
 */
describe("Twilio credentials", () => {
  it("should have TWILIO_ACCOUNT_SID configured", () => {
    expect(ENV.twilioAccountSid).toBeTruthy();
    expect(ENV.twilioAccountSid).toMatch(/^AC/);
  });

  it("should have TWILIO_AUTH_TOKEN configured", () => {
    expect(ENV.twilioAuthToken).toBeTruthy();
    expect(ENV.twilioAuthToken!.length).toBeGreaterThan(10);
  });

  it("should have TWILIO_WHATSAPP_FROM configured", () => {
    expect(ENV.twilioWhatsappFrom).toBeTruthy();
    expect(ENV.twilioWhatsappFrom).toMatch(/^whatsapp:/);
  });

  it("should be able to authenticate with Twilio API", async () => {
    const sid = ENV.twilioAccountSid;
    const token = ENV.twilioAuthToken;
    if (!sid || !token) {
      console.warn("[Twilio Test] Credentials not set — skipping live check");
      return;
    }

    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json() as { sid: string; status: string };
    expect(data.sid).toBe(sid);
    expect(data.status).toBe("active");
  }, 15000);
});
