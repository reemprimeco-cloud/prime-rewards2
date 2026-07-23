# Prime Rewards — Standalone Export

**PRIME Printing Co. Loyalty Programme**

This is a fully self-contained export of the Prime Rewards application. All Manus-specific dependencies have been removed and the project has been verified to install and build cleanly with standard Node.js tooling.

---

## Verified Build Status

| Check | Result |
|---|---|
| `npm install` | ✓ 701 packages, no ERESOLVE errors |
| `npm run build` | ✓ Vite + esbuild, no errors |
| `npm run check` | ✓ TypeScript, no type errors |

---

## Quick Start

```bash
# 1. Copy the environment template
cp env-template.txt .env
# Edit .env with your actual credentials

# 2. Install dependencies
npm install

# 3. Run database migrations
npm run db:push

# 4. Start development server
npm run dev

# 5. Build for production
npm run build && npm start
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS v4, tRPC, TanStack Query |
| Backend | Node.js, Express 4, tRPC server |
| Database | MySQL (Drizzle ORM) |
| Auth | JWT (jose), OAuth2 |
| Storage | S3-compatible (AWS SDK v3) |
| Invoicing | QuickBooks Online API |
| Notifications | Twilio WhatsApp |
| Testing | Vitest |

---

## What Was Removed (Manus-Specific)

The following were removed to make this project fully portable:

- `vite-plugin-manus-runtime` — Manus dev tooling (removed from `package.json` and `vite.config.ts`)
- `@builder.io/vite-plugin-jsx-loc` — Manus visual editor integration (removed)
- `client/public/__manus__/` — Manus debug collector scripts (removed)
- Manus `allowedHosts` entries in `vite.config.ts` (removed)
- `pnpm` as `packageManager` field (removed — use npm, pnpm, or yarn freely)
- `pnpm` patchedDependencies for wouter (removed — not needed outside Manus)

---

## Auth System Note

The project uses an OAuth2-based auth system (`server/_core/sdk.ts`). On Manus this connects to the Manus OAuth server. To self-host, you must replace `OAUTH_SERVER_URL` and `VITE_APP_ID` with your own OAuth2 provider (Auth0, Keycloak, etc.) or implement a simple username/password system.

See `MIGRATION_GUIDE.md` for step-by-step instructions.

---

## File Structure

```
prime-rewards/
├── client/          React frontend (Vite)
├── server/          Express + tRPC backend
├── shared/          Shared types and constants
├── drizzle/         Database schema and migrations
├── env-template.txt Copy to .env and populate
├── MIGRATION_GUIDE.md Self-hosting instructions
├── package.json
├── vite.config.ts
├── tsconfig.json
└── drizzle.config.ts
```
