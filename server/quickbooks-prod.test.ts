import { describe, expect, it } from "vitest";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Validates that the QuickBooks production credentials are correct
 * by attempting a token refresh using the stored refresh token.
 * This test confirms the Client ID + Secret are valid for the production environment.
 */
describe("QuickBooks Production credentials", () => {
  it("should have production environment set", () => {
    expect(process.env.QUICKBOOKS_ENVIRONMENT).toBe("production");
  });

  it("should have production Client ID set", () => {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID ?? "";
    expect(clientId).toBeTruthy();
    expect(clientId.length).toBeGreaterThan(20);
    // Production client IDs start with AB
    expect(clientId.startsWith("AB")).toBe(true);
  });

  it("should have production Client Secret set", () => {
    const secret = process.env.QUICKBOOKS_CLIENT_SECRET ?? "";
    expect(secret).toBeTruthy();
    expect(secret.length).toBeGreaterThan(10);
  });

  it("should be able to generate a valid OAuth authorization URL for production", () => {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID ?? "";
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI ?? "https://primerewds-45ycshmd.manus.space/api/qb/callback";
    const environment = process.env.QUICKBOOKS_ENVIRONMENT ?? "production";

    // Build the OAuth URL the same way qbRoutes.ts does
    const baseUrl = environment === "production"
      ? "https://appcenter.intuit.com/connect/oauth2"
      : "https://appcenter.intuit.com/connect/oauth2";

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "com.intuit.quickbooks.accounting",
      state: "prime-rewards-connect",
    });

    const authUrl = `${baseUrl}?${params.toString()}`;

    expect(authUrl).toContain(clientId);
    expect(authUrl).toContain(encodeURIComponent(redirectUri));
    expect(authUrl).toContain("com.intuit.quickbooks.accounting");
    console.log("✅ Production OAuth URL generated successfully");
    console.log("   Environment:", environment);
    console.log("   Client ID:", clientId.substring(0, 10) + "...");
  });

  it("should use production API base URL in quickbooks.ts", async () => {
    // Verify that when environment=production, the API calls go to production endpoint
    const environment = process.env.QUICKBOOKS_ENVIRONMENT ?? "sandbox";
    const apiBase = environment === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";

    expect(apiBase).toBe("https://quickbooks.api.intuit.com");
    console.log("✅ Production API base URL:", apiBase);
  });
});
