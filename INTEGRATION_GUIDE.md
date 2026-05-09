# Prime Rewards — Integration & Deployment Guide

**PRIME Printing Co. | Loyalty Program System**
Version 1.0 | May 2026

---

## Overview

This guide covers everything needed to connect Prime Rewards to your existing infrastructure and deploy it under `rewards.primeprint.com.kw`. The application is currently built and running on the Manus platform. When you are ready to publish, follow the sections below in order.

---

## 1. Custom Domain Setup

### DNS Configuration for `rewards.primeprint.com.kw`

Log into your domain registrar (the company where `primeprint.com.kw` is registered) and add the following DNS record:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `rewards` | Provided by Manus after publishing | 300 |

After publishing the app from the Manus dashboard, go to **Settings → Domains** in the Management UI and enter `rewards.primeprint.com.kw`. Manus will provide the exact CNAME target and handle SSL automatically via Let's Encrypt.

> **Note:** DNS propagation typically takes between 15 minutes and 48 hours depending on your registrar and TTL settings.

---

## 2. WhatsApp Notifications via Twilio

### What This Enables
Customers receive WhatsApp messages when points are added, rewards are redeemed, or welcome messages are triggered.

### Required Environment Variables

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID (starts with `AC...`) |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token |
| `TWILIO_WHATSAPP_FROM` | Your WhatsApp sender number, e.g. `whatsapp:+14155238886` |

### Installation

Install the Twilio SDK in the project:

```bash
cd /home/ubuntu/prime-rewards
pnpm add twilio
```

### Server-Side Integration (`server/whatsapp.ts`)

Create this helper file:

```typescript
import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  if (!process.env.TWILIO_ACCOUNT_SID) return; // Skip if not configured
  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${to}`,
      body: message,
    });
  } catch (err) {
    console.error("[WhatsApp] Failed to send message:", err);
  }
}
```

### Trigger Points in `server/db.ts`

Add `sendWhatsApp` calls after these existing events:

```typescript
// After invoice approval (in reviewInvoice function):
await sendWhatsApp(customer.phone, 
  `✅ *Prime Rewards Update*\nYour invoice #${invoice.invoiceNumber} has been approved!\n🌟 ${invoice.pointsEarned} points have been added to your account.\nCurrent balance: ${newBalance} pts`
);

// After reward redemption (in redeemReward function):
await sendWhatsApp(customer.phone,
  `🎁 *Reward Redeemed!*\nYou've successfully redeemed "${reward.name}".\nYour coupon code: *${couponCode}*\nRemaining balance: ${newBalance} pts`
);

// After customer registration (in createCustomer function):
await sendWhatsApp(customer.phone,
  `👋 *Welcome to Prime Rewards!*\nHi ${customer.name}, you're now enrolled in PRIME Printing Co.'s loyalty program.\nEarn 1 point for every 10 KWD spent. Start by submitting your first invoice!`
);
```

### Sandbox vs Production

During testing, use the **Twilio WhatsApp Sandbox**. Before going live, apply for a dedicated WhatsApp Business number through Twilio. The code above works identically for both — only the `TWILIO_WHATSAPP_FROM` number changes.

---

## 3. QuickBooks Invoice Validation

### What This Enables
When a customer submits an invoice number, the system queries QuickBooks Online to verify the invoice exists, check its status (paid/unpaid), and confirm it has not already been redeemed.

### Required Environment Variables

| Variable | Description |
|---|---|
| `QUICKBOOKS_CLIENT_ID` | From Intuit Developer Portal |
| `QUICKBOOKS_CLIENT_SECRET` | From Intuit Developer Portal |
| `QUICKBOOKS_REALM_ID` | Your QuickBooks Company ID |
| `QUICKBOOKS_REFRESH_TOKEN` | Generated during first OAuth authorization |

### Installation

```bash
pnpm add node-quickbooks intuit-oauth
```

### OAuth Setup (One-Time)

QuickBooks uses OAuth 2.0. Run this one-time setup script to generate your refresh token:

```typescript
// scripts/qb-auth.mts — run once with: node scripts/qb-auth.mts
import OAuthClient from "intuit-oauth";

const oauthClient = new OAuthClient({
  clientId: process.env.QUICKBOOKS_CLIENT_ID!,
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
  environment: "production", // or "sandbox" for testing
  redirectUri: "https://rewards.primeprint.com.kw/api/qb/callback",
});

const authUri = oauthClient.authorizeUri({
  scope: [OAuthClient.scopes.Accounting],
  state: "prime-rewards",
});

console.log("Open this URL in your browser:", authUri);
// After authorizing, copy the code from the callback URL and exchange it for tokens
```

### Invoice Validation Helper (`server/quickbooks.ts`)

```typescript
import OAuthClient from "intuit-oauth";

let oauthClient: OAuthClient | null = null;

function getClient() {
  if (!process.env.QUICKBOOKS_CLIENT_ID) return null;
  if (!oauthClient) {
    oauthClient = new OAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
      environment: "production",
      redirectUri: "https://rewards.primeprint.com.kw/api/qb/callback",
    });
    oauthClient.setToken({ refresh_token: process.env.QUICKBOOKS_REFRESH_TOKEN });
  }
  return oauthClient;
}

export async function validateQBInvoice(invoiceNumber: string): Promise<{
  valid: boolean;
  amount?: number;
  customerName?: string;
  status?: string;
  error?: string;
}> {
  const client = getClient();
  if (!client) return { valid: true }; // Skip validation if QB not configured

  try {
    await client.refresh(); // Refresh token if needed
    const token = client.getToken();
    const realmId = process.env.QUICKBOOKS_REALM_ID;
    const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}`;

    const response = await fetch(
      `${baseUrl}/query?query=SELECT * FROM Invoice WHERE DocNumber = '${invoiceNumber}'&minorversion=65`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();
    const invoice = data.QueryResponse?.Invoice?.[0];

    if (!invoice) return { valid: false, error: "Invoice not found in QuickBooks" };

    return {
      valid: true,
      amount: invoice.TotalAmt,
      customerName: invoice.CustomerRef?.name,
      status: invoice.Balance === 0 ? "paid" : "unpaid",
    };
  } catch (err) {
    console.error("[QuickBooks] Validation error:", err);
    return { valid: true }; // Fail open — don't block customer if QB is down
  }
}
```

### Wire into Invoice Submission

In `server/routers.ts`, inside the `invoices.submit` procedure, add before the `submitInvoice` call:

```typescript
// Validate against QuickBooks
const qbResult = await validateQBInvoice(input.invoiceNumber);
if (!qbResult.valid) {
  throw new TRPCError({ code: "BAD_REQUEST", message: qbResult.error ?? "Invoice not found" });
}
// Use QB amount if not provided
const invoiceAmount = qbResult.amount ?? input.invoiceAmount;
```

---

## 4. WooCommerce Order Sync

### What This Enables
When a WooCommerce order status changes to "completed", the customer automatically receives points without needing to submit an invoice manually.

### Required Environment Variables

| Variable | Description |
|---|---|
| `WOOCOMMERCE_STORE_URL` | e.g. `https://www.primeprint.com.kw` |
| `WOOCOMMERCE_CONSUMER_KEY` | From WooCommerce → Settings → Advanced → REST API |
| `WOOCOMMERCE_CONSUMER_SECRET` | From WooCommerce → Settings → Advanced → REST API |

### Installation

```bash
pnpm add @woocommerce/woocommerce-rest-api
```

### Webhook Setup in WordPress

In your WordPress admin, go to **WooCommerce → Settings → Advanced → Webhooks** and create a new webhook:

| Field | Value |
|---|---|
| Name | Prime Rewards — Order Completed |
| Status | Active |
| Topic | Order updated |
| Delivery URL | `https://rewards.primeprint.com.kw/api/woo/webhook` |
| Secret | Generate a random string and save it as `WOOCOMMERCE_WEBHOOK_SECRET` |

### Webhook Handler (`server/woocommerce.ts`)

```typescript
import crypto from "crypto";

export function verifyWooSignature(payload: string, signature: string): boolean {
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET ?? "";
  const hash = crypto.createHmac("sha256", secret).update(payload).digest("base64");
  return hash === signature;
}

export async function syncWooOrder(order: {
  id: number;
  status: string;
  total: string;
  billing: { phone: string; email: string; first_name: string; last_name: string };
}): Promise<void> {
  if (order.status !== "completed") return;

  const { getDb } = await import("./db");
  const { customers, invoices } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) return;

  const phone = order.billing.phone.replace(/\D/g, "");
  const name = `${order.billing.first_name} ${order.billing.last_name}`.trim();
  const amount = parseFloat(order.total);
  const invoiceNumber = `WOO-${order.id}`;

  // Find or create customer by phone
  let customer = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  // ... (create customer if not found, then award points)
  // This mirrors the submitInvoice flow with source = "woocommerce"
}
```

### Register the Webhook Route

In `server/_core/index.ts`, add an Express route for the webhook:

```typescript
app.post("/api/woo/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-wc-webhook-signature"] as string;
  const { verifyWooSignature, syncWooOrder } = await import("../woocommerce");

  if (!verifyWooSignature(req.body.toString(), signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const order = JSON.parse(req.body.toString());
  await syncWooOrder(order);
  res.json({ received: true });
});
```

---

## 5. Phone OTP Login

### What This Enables
Customers log in using their mobile number + a one-time password sent via WhatsApp or SMS, instead of the current Manus OAuth flow.

### Approach

The cleanest implementation uses Twilio Verify, which handles OTP generation, delivery, and validation:

```bash
pnpm add twilio
```

### Backend Procedures to Add in `server/routers.ts`

```typescript
// Send OTP
sendOtp: publicProcedure
  .input(z.object({ phone: z.string().min(8) }))
  .mutation(async ({ input }) => {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: input.phone, channel: "whatsapp" }); // or "sms"
    return { sent: true };
  }),

// Verify OTP
verifyOtp: publicProcedure
  .input(z.object({ phone: z.string(), code: z.string().length(6) }))
  .mutation(async ({ input, ctx }) => {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: input.phone, code: input.code });

    if (check.status !== "approved") {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired OTP" });
    }

    // Find or create customer, set session cookie
    // ... (mirrors existing OAuth callback logic)
    return { success: true };
  }),
```

### OTP Security Rules (as specified)
- Rate limit: max 3 OTP requests per phone number per 10 minutes (enforced by Twilio Verify automatically)
- Expiry: 60 seconds (configurable in Twilio Verify Service settings)
- Max retry attempts: 5 (configurable in Twilio Verify Service settings)

---

## 6. Environment Variables Summary

Add all of the following to the Manus project **Settings → Secrets** before publishing:

| Variable | Required For | Notes |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | WhatsApp + OTP | From Twilio Console |
| `TWILIO_AUTH_TOKEN` | WhatsApp + OTP | From Twilio Console |
| `TWILIO_WHATSAPP_FROM` | WhatsApp notifications | e.g. `whatsapp:+14155238886` |
| `TWILIO_VERIFY_SERVICE_SID` | Phone OTP login | Create in Twilio Console → Verify |
| `QUICKBOOKS_CLIENT_ID` | Invoice validation | From Intuit Developer Portal |
| `QUICKBOOKS_CLIENT_SECRET` | Invoice validation | From Intuit Developer Portal |
| `QUICKBOOKS_REALM_ID` | Invoice validation | Your QB Company ID |
| `QUICKBOOKS_REFRESH_TOKEN` | Invoice validation | Generated via OAuth flow |
| `WOOCOMMERCE_STORE_URL` | Order sync | e.g. `https://www.primeprint.com.kw` |
| `WOOCOMMERCE_CONSUMER_KEY` | Order sync | From WooCommerce REST API settings |
| `WOOCOMMERCE_CONSUMER_SECRET` | Order sync | From WooCommerce REST API settings |
| `WOOCOMMERCE_WEBHOOK_SECRET` | Order sync webhook | Random string you generate |

---

## 7. Pre-Launch Checklist

Before clicking **Publish** in the Manus dashboard, verify the following:

**Application**
- [ ] Admin account promoted to `admin` role via Database panel
- [ ] Default badges and rewards seeded via Admin → Settings → Seed Data
- [ ] At least one test invoice submitted and approved end-to-end
- [ ] Spin wheel tested with a real user account
- [ ] Rewards store redemption tested end-to-end

**Integrations (when credentials are ready)**
- [ ] Twilio WhatsApp sandbox tested with your own phone number
- [ ] QuickBooks sandbox invoice lookup verified
- [ ] WooCommerce test order webhook received and points awarded
- [ ] Phone OTP login tested on mobile

**Domain & SSL**
- [ ] CNAME record added at registrar for `rewards.primeprint.com.kw`
- [ ] Custom domain bound in Manus Settings → Domains
- [ ] SSL certificate issued (automatic, takes ~5 minutes after DNS propagates)
- [ ] PWA "Add to Home Screen" prompt tested on iOS Safari and Android Chrome

**Security**
- [ ] All API keys stored in Secrets (never in code)
- [ ] Admin panel accessible only to users with `role = admin`
- [ ] Fraud queue reviewed before launch

---

## 8. Making a User an Admin

After launch, to give yourself or a team member admin access:

1. Open the **Database** panel in the Manus Management UI
2. Navigate to the `users` table
3. Find the user by their email or name
4. Set their `role` column to `admin`

Alternatively, run this SQL via the Database panel:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 9. Future Phases (Prepared Structure)

The codebase is structured to support these future additions without major refactoring:

| Feature | Preparation Done |
|---|---|
| Native mobile app | PWA manifest + service worker in place; React Native can reuse all tRPC hooks |
| Push notifications | Service worker registered; add Web Push API when ready |
| AI recommendations | LLM helper already wired in the template (`server/_core/llm.ts`) |
| Multi-branch support | Add `branchId` column to `customers` and `invoices` tables |
| Apple Wallet loyalty cards | Use PassKit API with existing customer tier and points data |
| POS integration | Add a `pos` source type to `invoices.source` enum |

---

*This guide is maintained alongside the Prime Rewards codebase. Update it as integrations are added.*

---

## 10. Vercel Deployment (Alternative Hosting)

> **Note:** The application is already hosted on Manus with built-in custom domain support. This section covers Vercel as an alternative if your team prefers it.

### Step 1 — Export Code to GitHub

In the Manus Management UI, go to **Settings → GitHub** and export the project to a new repository under your GitHub account.

### Step 2 — Import into Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New Project**
2. Import the GitHub repository you just created
3. Set the **Framework Preset** to `Other` (this is a custom Express + Vite app)
4. Set the **Build Command** to: `pnpm build`
5. Set the **Output Directory** to: `dist`
6. Set the **Install Command** to: `pnpm install`

### Step 3 — Environment Variables in Vercel

In Vercel → Project → Settings → Environment Variables, add all variables from Section 6 above, plus the system variables the app requires:

| Variable | Value Source |
|---|---|
| `DATABASE_URL` | Your new database connection string (see Supabase section below) |
| `JWT_SECRET` | Generate a random 64-character string |
| `VITE_APP_ID` | Your Manus OAuth App ID (or replace with a new auth system) |

### Step 4 — Custom Domain on Vercel

In Vercel → Project → Settings → Domains, add `rewards.primeprint.com.kw`. Vercel will provide a CNAME target. Add this to your DNS registrar:

| Type | Name | Value |
|---|---|---|
| CNAME | `rewards` | `cname.vercel-dns.com` |

SSL is provisioned automatically by Vercel.

---

## 11. Supabase Migration (Alternative Backend)

> This section describes how to migrate the current MySQL/Drizzle backend to Supabase PostgreSQL if your team prefers the Supabase ecosystem.

### Database Schema Migration

The current schema uses MySQL syntax. Supabase uses PostgreSQL. The key differences to update in `drizzle/schema.ts`:

| MySQL (Current) | PostgreSQL (Supabase) |
|---|---|
| `mysqlTable` | `pgTable` |
| `mysqlEnum` | `pgEnum` |
| `int().autoincrement()` | `serial()` |
| `varchar(n)` | `varchar(n)` (same) |
| `timestamp` | `timestamp` (same) |
| `text` | `text` (same) |

**Migration steps:**

1. Install Supabase Drizzle adapter: `pnpm add drizzle-orm/postgres-js postgres`
2. Update all `import { ... } from "drizzle-orm/mysql-core"` to `"drizzle-orm/pg-core"` in `drizzle/schema.ts`
3. Replace `mysqlTable` → `pgTable`, `mysqlEnum` → `pgEnum`, `int().autoincrement()` → `serial()`
4. Run `pnpm drizzle-kit generate` to produce PostgreSQL migration SQL
5. Apply the migration in Supabase SQL Editor

### Supabase Connection String

In your Supabase project, go to **Settings → Database → Connection string** and copy the **URI** format. Set this as `DATABASE_URL` in your environment.

```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

### Supabase Authentication (Phone OTP)

Supabase has built-in phone OTP authentication. Enable it in **Authentication → Providers → Phone**. Connect it to Twilio using the same credentials from Section 2.

The auth flow then becomes:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

// Send OTP
await supabase.auth.signInWithOtp({ phone: "+96512345678" });

// Verify OTP
await supabase.auth.verifyOtp({ phone: "+96512345678", token: "123456", type: "sms" });
```

### Required Supabase Environment Variables

| Variable | Where to Find |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key (server-side only) |
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (URI) |

### Cutover Plan

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Apply the migrated schema SQL in the Supabase SQL Editor
3. Update `DATABASE_URL` in your environment to the Supabase connection string
4. Update `server/db.ts` to use `drizzle-orm/postgres-js` instead of `drizzle-orm/mysql2`
5. Test all procedures locally against the Supabase database
6. Deploy and switch DNS

---

*End of Integration & Deployment Guide*
