/**
 * QuickBooks OAuth 2.0 Express routes
 * GET  /api/qb/connect   → redirect admin to QB authorization page
 * GET  /api/qb/callback  → exchange code for tokens, persist to DB
 * GET  /api/qb/status    → return connection status (used by Admin Settings)
 */

import type { Express } from "express";
import {
  exchangeQBCode,
  getQBAuthUrl,
  isQBConfigured,
  isQBConnected,
} from "./quickbooks";
import { getDb } from "./db";
import { desc } from "drizzle-orm";
import { qbSettings } from "../drizzle/schema";
import { ENV } from "./_core/env";

export function registerQBRoutes(app: Express) {
  // ── Connect: redirect admin to QB authorization page ──────────────────────
  app.get("/api/qb/connect", (_req, res) => {
    if (!isQBConfigured()) {
      return res.status(500).json({ error: "QuickBooks credentials not configured" });
    }
    const state = Math.random().toString(36).slice(2);
    const authUrl = getQBAuthUrl(state);
    res.redirect(authUrl);
  });

  // ── Callback: exchange code for tokens ────────────────────────────────────
  app.get("/api/qb/callback", async (req, res) => {
    const { code, realmId, error } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(`/admin/settings?qb_error=${encodeURIComponent(error)}`);
    }
    if (!code || !realmId) {
      return res.redirect("/admin/settings?qb_error=missing_params");
    }

    try {
      const tokens = await exchangeQBCode(code);

      const db = await getDb();
      if (db) {
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        await db
          .insert(qbSettings)
          .values({
            realmId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt,
          })
          .onDuplicateKeyUpdate({
            set: {
              realmId,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt,
            },
          });
      }

      // Update runtime env so helpers pick up immediately without restart
      process.env.QUICKBOOKS_REALM_ID = realmId;
      process.env.QUICKBOOKS_REFRESH_TOKEN = tokens.refresh_token;

      res.redirect("/admin/settings?qb_connected=1");
    } catch (err: any) {
      console.error("[QB Callback] Error:", err);
      res.redirect(`/admin/settings?qb_error=${encodeURIComponent(err?.message ?? "unknown")}`);
    }
  });

  // ── Status: check connection state ────────────────────────────────────────
  app.get("/api/qb/status", async (_req, res) => {
    try {
      const db = await getDb();
      let dbRealmId: string | null = null;
      let connectedAt: Date | null = null;

      if (db) {
        const rows = await db.select().from(qbSettings).orderBy(desc(qbSettings.updatedAt)).limit(1);
        if (rows.length > 0) {
          dbRealmId = rows[0].realmId;
          connectedAt = rows[0].updatedAt ?? null;
          // Restore env vars from DB on server restart
          if (dbRealmId && !process.env.QUICKBOOKS_REALM_ID) {
            process.env.QUICKBOOKS_REALM_ID = dbRealmId;
          }
          if (rows[0].refreshToken && !process.env.QUICKBOOKS_REFRESH_TOKEN) {
            process.env.QUICKBOOKS_REFRESH_TOKEN = rows[0].refreshToken;
          }
        }
      }

      const realmId = dbRealmId ?? ENV.qbRealmId ?? null;

      res.json({
        configured: isQBConfigured(),
        connected: isQBConnected() || Boolean(realmId),
        realmId,
        environment: ENV.qbEnvironment,
        connectedAt,
      });
    } catch (err: any) {
      res.json({ configured: isQBConfigured(), connected: false, error: err?.message });
    }
  });
}
