# PRIME REWARDS — Self-Hosting Migration Guide

This guide covers the remaining steps to run Prime Rewards completely independently. The Manus-specific Vite plugins and packages have already been removed in this export.

---

## Step 1: Configure Environment Variables

Copy `env-template.txt` to `.env` and fill in all values. The key variables to set immediately are:

- `DATABASE_URL` — your MySQL connection string
- `JWT_SECRET` — a long random secret (32+ characters)
- `APP_BASE_URL` — your domain (e.g. `https://yourdomain.com`)

---

## Step 2: Replace the Auth System

The file `server/_core/sdk.ts` connects to the Manus OAuth2 server. You must replace this with your own auth provider.

**Option A — Auth0 or similar OAuth2 provider:**

1. Create an app in your provider's dashboard
2. Install the SDK: `npm install auth0` (or your provider's package)
3. Replace the `OAuthService.getTokenByCode()` and `OAuthService.getUserInfo()` methods with your provider's equivalents
4. Keep the JWT cookie logic (`SignJWT` / `jwtVerify`) — it is standard and works as-is
5. Update `OAUTH_SERVER_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID`, `VITE_OAUTH_PORTAL_URL` in `.env`

**Option B — Simple username/password auth:**

1. Add a `password_hash` column to the `users` table in `drizzle/schema.ts`
2. Install bcrypt: `npm install bcrypt && npm install -D @types/bcrypt`
3. Replace the OAuth flow in `server/_core/sdk.ts` with a POST `/api/auth/login` endpoint that verifies the password and issues a JWT cookie

---

## Step 3: Replace File Storage

`server/storage.ts` uses a Manus-internal S3 proxy. Replace with direct AWS S3 (the SDK is already installed).

**Replace `server/storage.ts` with:**

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.AWS_S3_BUCKET ?? "";

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: relKey, Body: data as any, ContentType: contentType }));
  return { key: relKey, url: `/files/${relKey}` };
}

export async function storageGetSignedUrl(relKey: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: relKey }), { expiresIn });
}

export async function storageGet(relKey: string) {
  const url = await storageGetSignedUrl(relKey);
  return { key: relKey, url };
}
```

Also remove the `registerStorageProxy(app)` call from `server/_core/index.ts` and delete `server/_core/storageProxy.ts`.

**Add to `.env`:**
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
```

---

## Step 4: Replace the Cron Scheduler

`server/_core/heartbeat.ts` registers scheduled jobs via the Manus API. Replace with `node-cron`.

```bash
npm install node-cron
npm install -D @types/node-cron
```

In `server/_core/index.ts`, replace heartbeat job registrations with:

```typescript
import cron from "node-cron";

// QB polling every 3 minutes
cron.schedule("*/3 * * * *", () => {
  // call your QB polling function
});
```

---

## Step 5: Run Database Migrations

```bash
npm run db:push
```

Or apply the SQL files in `drizzle/` manually in order (0000 → 0010).

---

## Step 6: Configure QuickBooks

1. Create an app at [developer.intuit.com](https://developer.intuit.com)
2. Set redirect URI to `https://yourdomain.com/api/qb/callback`
3. Fill in `QUICKBOOKS_*` variables in `.env`
4. Visit `/api/qb/auth` as admin to complete the OAuth flow
5. The refresh token is stored automatically in the `qb_settings` table

---

## Step 7: Configure Twilio WhatsApp

1. Create a Twilio account at [console.twilio.com](https://console.twilio.com)
2. Set up a WhatsApp Sender and Content Template
3. Fill in `TWILIO_*` variables in `.env`
