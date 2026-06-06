import { ENV } from "./_core/env";
import { getValidAccessToken, getQBRealmId, fetchQBCustomer, type QBInvoice } from "./quickbooks";
import { processQbPaymentEvent } from "./qbRewardsEngine";

/**
 * QB Payment Poller
 * -----------------
 * Reliable, webhook-free way to process QB payments. Every few minutes it asks
 * QuickBooks "which invoices changed recently?", picks the paid ones, and runs
 * them through the SAME processQbPaymentEvent pipeline the webhook uses.
 *
 * Safety guarantees:
 *  - POLLER_CUTOFF: only invoices updated AFTER the poller starts are processed,
 *    so it NEVER retroactively blasts WhatsApp messages for old paid invoices.
 *  - processQbPaymentEvent's qb_payment_syncs unique constraint blocks any invoice
 *    from being processed twice, so re-scanning the same invoices each poll is safe.
 *  - Runs independently of the webhook. If the webhook ever fires too, the duplicate
 *    guard prevents double-processing — you can safely keep both.
 */

const QB_BASE_URLS = {
  sandbox:    "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
};

const POLL_INTERVAL_MS      = 3 * 60 * 1000; // every 3 minutes
const MAX_INVOICES_PER_POLL = 30;

// Only invoices updated at/after this moment are eligible. Set when the poller
// starts, so historical paid invoices are never back-processed.
let POLLER_CUTOFF = Date.now();

let _running = false;
let _timer: NodeJS.Timeout | null = null;

async function queryRecentInvoices(maxResults = MAX_INVOICES_PER_POLL): Promise<QBInvoice[]> {
  const token   = await getValidAccessToken();
  const realmId = await getQBRealmId();
  const base    = QB_BASE_URLS[ENV.qbEnvironment];
  const query   = `SELECT * FROM Invoice ORDERBY MetaData.LastUpdatedTime DESC MAXRESULTS ${maxResults}`;
  const url     = `${base}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!res.ok) { const t = await res.text(); throw new Error(`QB API ${res.status}: ${t}`); }
  const data = await res.json();
  return data?.QueryResponse?.Invoice ?? [];
}

export async function pollQBPaidInvoices(): Promise<void> {
  if (_running) { console.log("[QB Poll] Previous run still in progress — skipping"); return; }
  _running = true;
  try {
    console.log(`\n[QB Poll] ═══ Polling ${new Date().toISOString()} ═══`);
    const invoices = await queryRecentInvoices();
    console.log(`[QB Poll] Fetched ${invoices.length} recent invoices`);

    for (const inv of invoices) {
      // Only fully paid invoices
      if (inv.Balance !== 0) continue;

      // Skip anything last updated before the poller started (prevents historical blast)
      const lastUpdated = (inv as any)?.MetaData?.LastUpdatedTime;
      if (lastUpdated && new Date(lastUpdated).getTime() < POLLER_CUTOFF) continue;

      const customerId = inv.CustomerRef?.value;
      if (!customerId) { console.warn(`[QB Poll] Invoice ${inv.DocNumber}: no CustomerRef`); continue; }

      const customer = await fetchQBCustomer(customerId);
      if (!customer) { console.warn(`[QB Poll] Invoice ${inv.DocNumber}: customer ${customerId} not found`); continue; }

      const phone = (typeof customer.Mobile === "string" ? customer.Mobile : undefined)
                 ?? (typeof customer.PrimaryPhone === "string" ? customer.PrimaryPhone : undefined);
      if (!phone) { console.warn(`[QB Poll] Invoice ${inv.DocNumber}: no phone for "${customer.DisplayName}" — skipping`); continue; }

      // Same pipeline as the webhook. Duplicate guard inside makes re-scans safe.
      const result = await processQbPaymentEvent({
        qbInvoiceId:   inv.Id,
        invoiceNumber: inv.DocNumber,
        customerPhone: phone,
        customerName:  customer.DisplayName,
        amount:        inv.TotalAmt,
      });

      if (result.status === "success") {
        console.log(`[QB Poll] ✅ Invoice ${inv.DocNumber}: ${JSON.stringify(result)}`);
      } else if (result.status !== "duplicate") {
        console.log(`[QB Poll] Invoice ${inv.DocNumber}: ${JSON.stringify(result)}`);
      }
      // status === "duplicate" → already processed, skip silently
    }
    console.log(`[QB Poll] ═══ Done ═══`);
  } catch (err: any) {
    console.error(`[QB Poll] ❌ ${err?.message}`);
  } finally {
    _running = false;
  }
}

export function startQBPolling(): void {
  if (_timer) { console.log("[QB Poll] Already running"); return; }
  POLLER_CUTOFF = Date.now();
  console.log(`[QB Poll] Starting poller — every ${POLL_INTERVAL_MS / 1000}s. Only invoices paid from now on are processed.`);
  // First run 10s after boot (so you can test quickly), then on the interval.
  setTimeout(() => { void pollQBPaidInvoices(); }, 10_000);
  _timer = setInterval(() => { void pollQBPaidInvoices(); }, POLL_INTERVAL_MS);
}

export function stopQBPolling(): void {
  if (_timer) { clearInterval(_timer); _timer = null; }
}
