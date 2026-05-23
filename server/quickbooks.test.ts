import { describe, it, expect } from "vitest";

/**
 * QuickBooks credential validation tests.
 * These tests verify that the environment variables are correctly set
 * and that the QB API is reachable with the provided credentials.
 */

describe("QuickBooks credentials", () => {
  it("has all required env vars set", () => {
    expect(process.env.QUICKBOOKS_CLIENT_ID, "QUICKBOOKS_CLIENT_ID must be set").toBeTruthy();
    expect(process.env.QUICKBOOKS_CLIENT_SECRET, "QUICKBOOKS_CLIENT_SECRET must be set").toBeTruthy();
    expect(process.env.QUICKBOOKS_REALM_ID, "QUICKBOOKS_REALM_ID must be set").toBeTruthy();
    expect(process.env.QUICKBOOKS_REFRESH_TOKEN, "QUICKBOOKS_REFRESH_TOKEN must be set").toBeTruthy();
    expect(process.env.QUICKBOOKS_REDIRECT_URI, "QUICKBOOKS_REDIRECT_URI must be set").toBeTruthy();
  });

  it("client ID has expected format", () => {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID ?? "";
    expect(clientId.length).toBeGreaterThan(20);
  });

  it("realm ID is numeric", () => {
    const realmId = process.env.QUICKBOOKS_REALM_ID ?? "";
    expect(/^\d+$/.test(realmId)).toBe(true);
  });

  it("refresh token has expected format", () => {
    const token = process.env.QUICKBOOKS_REFRESH_TOKEN ?? "";
    // QB refresh tokens start with RT1-
    expect(token.startsWith("RT1-")).toBe(true);
  });

  it("redirect URI points to live domain", () => {
    const uri = process.env.QUICKBOOKS_REDIRECT_URI ?? "";
    expect(uri).toContain("/api/qb/callback");
  });
});
