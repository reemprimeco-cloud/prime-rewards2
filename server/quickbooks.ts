import { ENV } from "./_core/env";
import { getDb } from "./db";
import { desc } from "drizzle-orm";
import { qbSettings } from "../drizzle/schema";

const QB_BASE_URLS = {
  sandbox:    "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
};

const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// ─── Token cache ──────────────────────────────────────────────────────────────

let _cachedAccessToken:  string | null = null;
let _cachedTokenExpiry:  number        = 0;
let _cachedRefreshToken: string | null = null;
let _cachedRealmId:      string | null = null;

async function loadQBSettingsFromDB(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db.select().from(qbSettings).orderBy(desc(qbSettings.updatedAt)).limit(1);
    if (rows.length > 0) {
      const row = rows[0];
      _cachedRealmId      = row.realmId;
      _cachedRefreshToken = row.refreshToken;
      if (row.accessToken && row.expiresAt && row.expiresAt.getTime() > Date.now() + 60_000) {
        _cachedAccessToken = row.accessToken;
        _cachedTokenExpiry = row.expiresAt.getTime();
      }
    }
  } catch {}
}

async function saveQBTokensToDB(realmId: string, accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    await db.insert(qbSettings).values({ realmId, accessToken, refreshToken, expiresAt })
      .onDuplicateKeyUpdate({ set: { realmId, accessToken, refreshToken, expiresAt } });
  } catch (err) {
    console.warn("[QB] Failed to persist tokens:", err);
  }
}

export async function getQBRealmId(): Promise<string> {
  if (_cachedRealmId) return _cachedRealmId;
  await loadQBSettingsFromDB();
  if (_cachedRealmId) return _cachedRealmId;
  if (ENV.qbRealmId) { _cachedRealmId = ENV.qbRealmId; return ENV.qbRealmId; }
  throw new Error("QuickBooks Realm ID not configured.");
}

export async function getValidAccessToken(): Promise<string> {
  const now = Date.now();
  if (_cachedAccessToken && _cachedTokenExpiry > now + 60_000) return _cachedAccessToken;
  if (!_cachedRefreshToken) await loadQBSettingsFromDB();

  const refreshToken = _cachedRefreshToken || ENV.qbRefreshToken;
  if (!refreshToken) throw new Error("QuickBooks not connected. Complete OAuth setup in Admin Settings.");

  const realmId = _cachedRealmId || ENV.qbRealmId;
  if (!realmId) throw new Error("QuickBooks Realm ID not configured.");

  try {
    const res = await fetch(QB_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${ENV.qbClientId}:${ENV.qbClientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`QB token refresh failed: ${res.status} ${t}`); }
    const tokens = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
    _cachedAccessToken  = tokens.access_token;
    _cachedTokenExpiry  = now + tokens.expires_in * 1000;
    _cachedRefreshToken = tokens.refresh_token;
    _cachedRealmId      = realmId;
    await saveQBTokensToDB(realmId, tokens.access_token, tokens.refresh_token, tokens.expires_in);
    return _cachedAccessToken;
  } catch (err: any) {
    const msg: string = err?.message ?? "";
    if (msg.includes("invalid_grant") || msg.includes("400")) {
      _cachedAccessToken = null; _cachedTokenExpiry = 0; _cachedRefreshToken = null;
      throw new Error("QB_TOKEN_EXPIRED: Please re-authorize QuickBooks in Admin Settings.");
    }
    throw err;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QBInvoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  TotalAmt: number;
  Balance: number;
  CustomerRef: { value: string; name: string };
}

export interface QBCustomer {
  Id: string;
  DisplayName: string;
  PrimaryPhone?: { FreeFormNumber?: string } | string;
  Mobile?: { FreeFormNumber?: string } | string;
}

export type QBInvoiceStatus = "paid" | "unpaid" | "partial" | "not_found";

export interface QBInvoiceLookupResult {
  found: boolean;
  status: QBInvoiceStatus;
  invoice?: QBInvoice;
  customerName?: string;
  totalAmount?: number;
  errorMessage?: string;
  tokenExpired?: boolean;
}

// ─── Customer fetch ───────────────────────────────────────────────────────────

export async function fetchQBCustomer(customerId: string): Promise<QBCustomer | null> {
  try {
    const token   = await getValidAccessToken();
    const realmId = await getQBRealmId();
    const base    = QB_BASE_URLS[ENV.qbEnvironment];
    const safeId  = customerId.replace(/['"\\]/g, "");
    const query   = `SELECT * FROM Customer WHERE Id = '${safeId}'`;
    const url     = `${base}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) { console.warn(`[QB] Customer ${customerId}: ${res.status}`); return null; }

    const data = await res.json();
    const raw  = data?.QueryResponse?.Customer?.[0];
    if (!raw) { console.warn(`[QB] Customer ${customerId} not found`); return null; }

    const extractPhone = (f: any): string | undefined => {
      if (!f) return undefined;
      if (typeof f === "string") return f || undefined;
      return f?.FreeFormNumber || undefined;
    };

    const customer: QBCustomer = { ...raw, Mobile: extractPhone(raw.Mobile), PrimaryPhone: extractPhone(raw.PrimaryPhone) };
    console.log(`[QB] Customer: ${customer.DisplayName}  Mobile=${customer.Mobile}  Primary=${customer.PrimaryPhone}`);
    return customer;
  } catch (err: any) {
    console.error(`[QB] Customer fetch error: ${err?.message}`);
    return null;
  }
}

// ─── Invoice lookup by entity ID (from webhook) ───────────────────────────────

export async function lookupQBInvoiceById(invoiceId: string): Promise<QBInvoiceLookupResult> {
  try {
    const token   = await getValidAccessToken();
    const realmId = await getQBRealmId();
    const base    = QB_BASE_URLS[ENV.qbEnvironment];
    const safeId  = invoiceId.replace(/['^\\]/g, "");
    const url     = `${base}/v3/company/${realmId}/invoice/${safeId}?minorversion=65`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (res.status === 404) return { found: false, status: "not_found" };
    if (!res.ok) { const t = await res.text(); throw new Error(`QB API ${res.status}: ${t}`); }

    const data = await res.json();
    const inv: QBInvoice = data.Invoice ?? data;
    const status: QBInvoiceStatus = inv.Balance === 0 ? "paid" : inv.Balance < inv.TotalAmt ? "partial" : "unpaid";
    console.log(`[QB] Invoice ${invoiceId}: DocNumber=${inv.DocNumber}  Balance=${inv.Balance}  status=${status}`);
    return { found: true, status, invoice: inv, customerName: inv.CustomerRef?.name, totalAmount: inv.TotalAmt };
  } catch (err: any) {
    console.error(`[QB] Invoice by ID error: ${err?.message}`);
    return { found: false, status: "not_found", errorMessage: err?.message, tokenExpired: (err?.message ?? "").includes("QB_TOKEN_EXPIRED") };
  }
}

// ─── Invoice lookup by DocNumber (kept for other callers) ─────────────────────

export async function lookupQBInvoice(invoiceNumber: string): Promise<QBInvoiceLookupResult> {
  try {
    const token   = await getValidAccessToken();
    const realmId = await getQBRealmId();
    const base    = QB_BASE_URLS[ENV.qbEnvironment];
    const safeNum = invoiceNumber.replace(/['"\\]/g, "");
    const query   = `SELECT * FROM Invoice WHERE DocNumber = '${safeNum}' MAXRESULTS 1`;
    const url     = `${base}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) { const t = await res.text(); throw new Error(`QB API ${res.status}: ${t}`); }

    const data = await res.json();
    const invoices: QBInvoice[] = data?.QueryResponse?.Invoice ?? [];
    if (invoices.length === 0) return { found: false, status: "not_found" };

    const inv = invoices[0];
    const status: QBInvoiceStatus = inv.Balance === 0 ? "paid" : inv.Balance < inv.TotalAmt ? "partial" : "unpaid";
    return { found: true, status, invoice: inv, customerName: inv.CustomerRef?.name, totalAmount: inv.TotalAmt };
  } catch (err: any) {
    console.error("[QB] Invoice lookup error:", err?.message);
    const tokenExpired = (err?.message ?? "").includes("QB_TOKEN_EXPIRED");
    return { found: false, status: "not_found", errorMessage: err?.message, tokenExpired };
  }
}

// ─── Invoice lookup by phone (kept for other callers) ─────────────────────────

export async function lookupQBInvoiceByPhone(phone: string): Promise<QBInvoiceLookupResult[]> {
  try {
    const token   = await getValidAccessToken();
    const realmId = await getQBRealmId();
    const base    = QB_BASE_URLS[ENV.qbEnvironment];
    const safePhone = phone.replace(/[\s\-().+'"\\]/g, "");
    const cQuery  = `SELECT * FROM Customer WHERE PrimaryPhone = '${safePhone}' OR Mobile = '${safePhone}' MAXRESULTS 5`;
    const cUrl    = `${base}/v3/company/${realmId}/query?query=${encodeURIComponent(cQuery)}&minorversion=65`;

    const cRes = await fetch(cUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!cRes.ok) { const t = await cRes.text(); throw new Error(`QB API ${cRes.status}: ${t}`); }
    const cData = await cRes.json();
    const customers = cData?.QueryResponse?.Customer ?? [];
    if (customers.length === 0) return [];

    const results: QBInvoiceLookupResult[] = [];
    for (const customer of customers.slice(0, 3)) {
      const safeId  = customer.Id.replace(/['"\\]/g, "");
      const iQuery  = `SELECT * FROM Invoice WHERE CustomerRef = '${safeId}' ORDERBY TxnDate DESC MAXRESULTS 5`;
      const iUrl    = `${base}/v3/company/${realmId}/query?query=${encodeURIComponent(iQuery)}&minorversion=65`;
      const iRes    = await fetch(iUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (!iRes.ok) continue;
      const iData   = await iRes.json();
      const invoices: QBInvoice[] = iData?.QueryResponse?.Invoice ?? [];
      for (const inv of invoices) {
        const status: QBInvoiceStatus = inv.Balance === 0 ? "paid" : inv.Balance < inv.TotalAmt ? "partial" : "unpaid";
        results.push({ found: true, status, invoice: inv, customerName: inv.CustomerRef?.name ?? customer.DisplayName, totalAmount: inv.TotalAmt });
      }
    }
    return results;
  } catch (err: any) {
    console.error("[QB] Phone lookup error:", err?.message);
    return [];
  }
}

// ─── Payment: resolve linked invoice IDs ─────────────────────────────────────

export async function fetchQBPaymentLinkedInvoiceIds(paymentId: string): Promise<string[]> {
  try {
    const token   = await getValidAccessToken();
    const realmId = await getQBRealmId();
    const base    = QB_BASE_URLS[ENV.qbEnvironment];
    const safeId  = paymentId.replace(/['"\\]/g, "");
    const url     = `${base}/v3/company/${realmId}/payment/${safeId}?minorversion=65`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) { console.error(`[QB] Payment ${paymentId}: ${res.status}`); return []; }

    const data    = await res.json();
    const payment = data?.Payment ?? data;
    const ids: string[] = [];
    for (const line of (payment?.Line ?? [])) {
      for (const txn of (line?.LinkedTxn ?? [])) {
        if (txn.TxnType === "Invoice") ids.push(txn.TxnId);
      }
    }
    console.log(`[QB] Payment ${paymentId} linked invoices: ${ids.join(", ") || "none"}`);
    return ids;
  } catch (err: any) {
    console.error(`[QB] Payment fetch error: ${err?.message}`);
    return [];
  }
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export function isQBConnected(): boolean {
  return Boolean(ENV.qbClientId && ENV.qbClientSecret && (ENV.qbRealmId || _cachedRealmId) && (ENV.qbRefreshToken || _cachedRefreshToken));
}

export function isQBConfigured(): boolean {
  return Boolean(ENV.qbClientId && ENV.qbClientSecret);
}

// ─── OAuth 2.0 helpers ────────────────────────────────────────────────────────

export function getQBAuthUrl(state: string): string {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID || process.env.QB_CLIENT_ID;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || `${process.env.VITE_APP_URL || "https://primerewds.com"}/api/qb/callback`;
  const scope = "com.intuit.quickbooks.accounting";
  const authUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
  authUrl.searchParams.set("client_id", clientId || "");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  return authUrl.toString();
}

export async function exchangeQBCode(code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID || process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || process.env.QB_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || `${process.env.VITE_APP_URL || "https://primerewds.com"}/api/qb/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("QB_CLIENT_ID or QB_CLIENT_SECRET not configured");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QB OAuth error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}
