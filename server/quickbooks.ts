/**
 * QuickBooks Online API integration helper
 * Handles OAuth token management and invoice lookup/validation.
 * Tokens are persisted in the qb_settings DB table and cached in memory.
 */

import { ENV } from "./_core/env";
import { getDb } from "./db";
import { desc } from "drizzle-orm";
import { qbSettings } from "../drizzle/schema";

const QB_BASE_URLS = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
};

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// ─── OAuth ──────────────────────────────────────────────────────────────────

/** Generate the QuickBooks OAuth 2.0 authorization URL */
export function getQBAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: ENV.qbClientId,
    redirect_uri: ENV.qbRedirectUri,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    state,
  });
  return `${QB_AUTH_URL}?${params.toString()}`;
}

/** Exchange authorization code for access + refresh tokens */
export async function exchangeQBCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(`${ENV.qbClientId}:${ENV.qbClientSecret}`).toString("base64");
  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ENV.qbRedirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QB token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Refresh the access token using the stored refresh token */
export async function refreshQBToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(`${ENV.qbClientId}:${ENV.qbClientSecret}`).toString("base64");
  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QB token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ─── Token store (in-memory cache + DB persistence) ─────────────────────────

let _cachedAccessToken: string | null = null;
let _cachedTokenExpiry: number = 0;
let _cachedRealmId: string | null = null;
let _cachedRefreshToken: string | null = null;

/** Load QB settings from DB into memory cache (called on first use) */
async function loadQBSettingsFromDB(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db.select().from(qbSettings).orderBy(desc(qbSettings.updatedAt)).limit(1);
    if (rows.length > 0) {
      const row = rows[0];
      _cachedRealmId = row.realmId;
      _cachedRefreshToken = row.refreshToken;
      if (row.accessToken && row.expiresAt && row.expiresAt.getTime() > Date.now() + 60_000) {
        _cachedAccessToken = row.accessToken;
        _cachedTokenExpiry = row.expiresAt.getTime();
      }
    }
  } catch {
    // Silently fail — will fall back to env vars
  }
}

/** Persist new tokens to DB */
async function saveQBTokensToDB(
  realmId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    await db
      .insert(qbSettings)
      .values({ realmId, accessToken, refreshToken, expiresAt })
      .onDuplicateKeyUpdate({ set: { realmId, accessToken, refreshToken, expiresAt } });
  } catch (err) {
    console.warn("[QB] Failed to persist tokens to DB:", err);
  }
}

/** Get the current realm ID (from cache, DB, or env) */
export async function getQBRealmId(): Promise<string> {
  if (_cachedRealmId) return _cachedRealmId;
  await loadQBSettingsFromDB();
  if (_cachedRealmId) return _cachedRealmId;
  // Fall back to env var
  const envRealmId = ENV.qbRealmId;
  if (envRealmId) {
    _cachedRealmId = envRealmId;
    return envRealmId;
  }
  throw new Error("QuickBooks Realm ID not configured.");
}

/** Get a valid access token, refreshing if necessary */
export async function getValidAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (_cachedAccessToken && _cachedTokenExpiry > now + 60_000) {
    return _cachedAccessToken;
  }

  // Load from DB if not yet loaded
  if (!_cachedRefreshToken) {
    await loadQBSettingsFromDB();
  }

  // Use env var refresh token as final fallback
  const refreshToken = _cachedRefreshToken || ENV.qbRefreshToken;
  if (!refreshToken) {
    throw new Error("QuickBooks not connected. Please complete OAuth setup in Admin Settings.");
  }

  const realmId = _cachedRealmId || ENV.qbRealmId;
  if (!realmId) {
    throw new Error("QuickBooks Realm ID not configured.");
  }

  try {
    const tokens = await refreshQBToken(refreshToken);
    _cachedAccessToken = tokens.access_token;
    _cachedTokenExpiry = now + tokens.expires_in * 1000;
    _cachedRefreshToken = tokens.refresh_token;
    _cachedRealmId = realmId;

    // Persist updated tokens
    await saveQBTokensToDB(realmId, tokens.access_token, tokens.refresh_token, tokens.expires_in);

    return _cachedAccessToken;
  } catch (err: any) {
    // Detect expired/revoked refresh token — guide admin to re-authorize
    const msg: string = err?.message ?? "";
    if (msg.includes("invalid_grant") || msg.includes("400")) {
      // Clear stale cached tokens so next call tries fresh
      _cachedAccessToken = null;
      _cachedTokenExpiry = 0;
      _cachedRefreshToken = null;
      throw new Error(
        "QB_TOKEN_EXPIRED: Your QuickBooks authorization has expired or been revoked. " +
        "Please go to Admin → Settings → QuickBooks Integration and click \"Re-authorize QuickBooks\" to reconnect."
      );
    }
    throw err;
  }
}

// ─── Invoice Lookup ──────────────────────────────────────────────────────────

export interface QBInvoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance: number;
  CustomerRef: { value: string; name: string };
}

export interface QBCustomer {
  Id: string;
  DisplayName: string;
  PrimaryPhone?: string;
  Mobile?: string;
  Email?: string;
  BillAddr?: {
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

export type QBInvoiceStatus = "paid" | "unpaid" | "partial" | "not_found";

export interface QBInvoiceLookupResult {
  tokenExpired?: boolean;
  found: boolean;
  status: QBInvoiceStatus;
  invoice?: QBInvoice;
  customerName?: string;
  totalAmount?: number;
  errorMessage?: string;
}

/** Fetch customer details from QB API including mobile phone */
export async function fetchQBCustomer(customerId: string): Promise<QBCustomer | null> {
  try {
    const accessToken = await getValidAccessToken();
    const realmId = await getQBRealmId();
    const baseUrl = QB_BASE_URLS[ENV.qbEnvironment];

    const safeId = customerId.replace(/['"\\]/g, "");
    const query = `SELECT * FROM Customer WHERE Id = '${safeId}'`;
    const url = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`[QB] Failed to fetch customer ${customerId}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const customers: QBCustomer[] = data?.QueryResponse?.Customer ?? [];

    if (customers.length === 0) {
      console.warn(`[QB] Customer not found: ${customerId}`);
      return null;
    }

    return customers[0];
  } catch (err: any) {
    console.error(`[QB] Error fetching customer ${customerId}:`, err?.message);
    return null;
  }
}

/** Look up an invoice by document number in QuickBooks */
export async function lookupQBInvoice(invoiceNumber: string): Promise<QBInvoiceLookupResult> {
  try {
    const accessToken = await getValidAccessToken();
    const realmId = await getQBRealmId();
    const baseUrl = QB_BASE_URLS[ENV.qbEnvironment];

    // Sanitise input to prevent injection
    const safeNum = invoiceNumber.replace(/['"\\]/g, "");
    const query = `SELECT * FROM Invoice WHERE DocNumber = '${safeNum}' MAXRESULTS 1`;
    const url = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`QB API error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const invoices: QBInvoice[] = data?.QueryResponse?.Invoice ?? [];

    if (invoices.length === 0) {
      return { found: false, status: "not_found" };
    }

    const inv = invoices[0];
    let status: QBInvoiceStatus;

    if (inv.Balance === 0) {
      status = "paid";
    } else if (inv.Balance < inv.TotalAmt) {
      status = "partial";
    } else {
      status = "unpaid";
    }

    return {
      found: true,
      status,
      invoice: inv,
      customerName: inv.CustomerRef?.name,
      totalAmount: inv.TotalAmt,
    };
  } catch (err: any) {
    console.error("[QB] Invoice lookup error:", err?.message);
    const isTokenExpired = (err?.message ?? "").includes("QB_TOKEN_EXPIRED");
    return {
      found: false,
      status: "not_found",
      errorMessage: isTokenExpired
        ? err.message
        : (err?.message ?? "Unknown error looking up invoice"),
      tokenExpired: isTokenExpired,
    };
  }
}

/** Look up invoices by customer phone number in QuickBooks */
export async function lookupQBInvoiceByPhone(phone: string): Promise<QBInvoiceLookupResult[]> {
  try {
    const accessToken = await getValidAccessToken();
    const realmId = await getQBRealmId();
    const baseUrl = QB_BASE_URLS[ENV.qbEnvironment];

    // Normalize phone: strip spaces, dashes, parens, leading +
    const normalizedPhone = phone.replace(/[\s\-().+]/g, "");

    // Step 1: Find customers matching this phone
    const safePhone = normalizedPhone.replace(/['"\\]/g, "");
    const customerQuery = `SELECT * FROM Customer WHERE PrimaryPhone = '${safePhone}' OR Mobile = '${safePhone}' MAXRESULTS 5`;
    const customerUrl = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(customerQuery)}&minorversion=65`;

    const customerRes = await fetch(customerUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });

    if (!customerRes.ok) {
      const text = await customerRes.text();
      throw new Error(`QB API error: ${customerRes.status} ${text}`);
    }

    const customerData = await customerRes.json();
    const customers = customerData?.QueryResponse?.Customer ?? [];

    if (customers.length === 0) {
      return [];
    }

    // Step 2: For each matching customer, find their unpaid/recent invoices
    const results: QBInvoiceLookupResult[] = [];

    for (const customer of customers.slice(0, 3)) {
      const safeId = customer.Id.replace(/['"\\]/g, "");
      const invoiceQuery = `SELECT * FROM Invoice WHERE CustomerRef = '${safeId}' ORDERBY TxnDate DESC MAXRESULTS 5`;
      const invoiceUrl = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(invoiceQuery)}&minorversion=65`;

      const invoiceRes = await fetch(invoiceUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });

      if (!invoiceRes.ok) continue;

      const invoiceData = await invoiceRes.json();
      const invoices: QBInvoice[] = invoiceData?.QueryResponse?.Invoice ?? [];

      for (const inv of invoices) {
        let status: QBInvoiceStatus;
        if (inv.Balance === 0) status = "paid";
        else if (inv.Balance < inv.TotalAmt) status = "partial";
        else status = "unpaid";

        results.push({
          found: true,
          status,
          invoice: inv,
          customerName: inv.CustomerRef?.name ?? customer.DisplayName,
          totalAmount: inv.TotalAmt,
        });
      }
    }

    return results;
  } catch (err: any) {
    console.error("[QB] Phone lookup error:", err?.message);
    return [];
  }
}

/** Check if QuickBooks is fully connected (has realm + refresh token) */
export function isQBConnected(): boolean {
  return Boolean(
    ENV.qbClientId &&
    ENV.qbClientSecret &&
    (ENV.qbRealmId || _cachedRealmId) &&
    (ENV.qbRefreshToken || _cachedRefreshToken)
  );
}

/** Check if QuickBooks client credentials are configured */
export function isQBConfigured(): boolean {
  return Boolean(ENV.qbClientId && ENV.qbClientSecret);
}
