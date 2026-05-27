# Prime Rewards — TODO

## Phase 1: Foundation
- [x] Upload PRIME Printing Co. logo to static assets
- [x] Set brand theme (Navy Blue #1B2A5E, Light Blue #5B9BD5, White) in index.css
- [x] Write full database schema (customers, invoices, rewards, redemptions, campaigns, badges, notifications, spin_results, point_transactions, fraud_flags)
- [x] Generate and apply DB migrations

## Phase 2: Backend API
- [x] Customer profile CRUD (get, update)
- [x] Points earning: submit invoice, award/deduct points (admin)
- [x] Invoice management: create, list, approve/reject, duplicate detection
- [x] Rewards store: list rewards, redeem reward
- [x] Tier calculation logic (Bronze/Silver/Gold/Platinum)
- [x] Badge award logic (First Order, Loyal Customer, Big Spender + others)
- [x] Spin wheel: daily spin eligibility, spin result, record spin
- [x] Campaigns: create, list, activate/deactivate, multiplier logic
- [x] Point expiration: check and expire points, send warnings
- [x] Notifications: in-app notifications list, mark read
- [x] Fraud protection: duplicate invoice check, rate limiting, flag suspicious activity
- [x] Admin analytics: total customers, active customers, redeemed rewards, monthly activity
- [x] Admin: createReward, deleteReward, createCampaign, deleteCampaign procedures
- [x] Fraud: list with status filter

## Phase 3: Customer UI
- [x] Landing page (hero, benefits, join CTA, tier overview)
- [x] Login / OAuth flow
- [x] Customer dashboard (points balance, tier, expiry countdown, recent activity)
- [x] Transaction history page
- [x] Rewards store page (visual reward cards, redeem flow)
- [x] Spin-and-Win wheel page (animated wheel, daily eligibility)
- [x] Profile page (customer info, referral code, achievement badges)
- [x] Notifications panel/page
- [x] Invoice submission page

## Phase 4: Admin UI
- [x] Admin dashboard overview (analytics charts, KPIs)
- [x] Customer management (list, search, view profile, adjust points)
- [x] Invoice management (list, approve/reject, flag)
- [x] Rewards management (create, delete rewards)
- [x] Campaigns management (create, deactivate, start/end dates, multiplier)
- [x] Fraud queue (open/reviewed/dismissed filters, review actions)
- [x] AdminLayout with role guard

## Phase 5: Polish & Tests
- [x] Mobile-first responsive design (bottom tab bar on mobile, sidebar on desktop)
- [x] Smooth animations (framer-motion) on landing page
- [x] Vitest unit tests: 25 tests passing (tier logic, points calc, expiry, fraud, auth)
- [x] TypeScript: 0 errors
- [x] PRIME logo applied across all layouts with correct brand colors
- [x] All routes wired in App.tsx

## Phase 5 (Extended): PWA + QR + Missing Pages
- [x] Add PWA manifest.json and service worker for "Add to Home Screen"
- [x] Add QR code generation (invoice QR, referral QR, campaign QR)
- [x] Add Edit Reward capability in AdminRewards
- [x] Add Referral page for customers
- [x] Add Admin Settings page (points config, expiry settings, seed data)
- [x] Verify notifications page is wired and accessible

## Phase 6: Integration & Deployment Guide
- [x] Write comprehensive integration guide (WhatsApp/Twilio, QuickBooks, WooCommerce, Phone OTP, DNS/Vercel, Supabase migration)

## Phase 7: Currency & Language
- [x] Change all currency to Kuwaiti Dinar (KD)
- [x] Create LanguageContext with Arabic/English translations
- [x] Add RTL layout support when Arabic is active
- [x] Add Arabic/English toggle icon button to CustomerLayout and AdminLayout
- [x] Translate all pages and components to Arabic

## Phase 8: QuickBooks Integration
- [x] Store QB secrets (client ID, secret, environment, redirect URI)
- [x] Build QB OAuth 2.0 connect URL generator (server-side)
- [x] Build QB OAuth callback handler (/api/qb/callback) — exchange code for tokens, store realm_id + refresh_token
- [x] Build QB token refresh helper (auto-refresh access token using refresh token)
- [x] Build QB invoice lookup helper (search by invoice number via QB API)
- [x] Validate invoice: check existence, paid/unpaid status, duplicate claim detection
- [x] Wire invoice submission to QB validation before awarding points
- [x] Add QB connection status + Connect button in Admin Settings
- [x] Show QB validation result in invoice submission UI (customer-facing)
- [x] Save checkpoint

## Phase 9: Invoice Lookup Improvements
- [x] Support invoice lookup by Invoice Number OR phone number in QB
- [x] Auto-fetch invoice amount from QuickBooks (remove manual amount field)
- [x] Show fetched invoice details (amount, customer name, status) before submission
- [x] Fix expired QB refresh token — add re-auth flow and better error handling
- [x] Update tRPC validateQB procedure to return amount + customer info
- [x] Rewrite Invoices.tsx: single search field, auto-populated amount, confirm-then-submit flow
- [x] Save checkpoint

## Phase 10: Platform Upgrade (v2)

- [x] Add whatsapp_logs table to schema
- [x] Add failed_attempts table to schema
- [x] Add suspicious_accounts table to schema
- [x] Add pending_customers table to schema
- [x] Run DB migrations for new tables
- [x] Backend: enforce 1pt per 10 KD points calculation (floor division)
- [x] Backend: rate limiting (max 5 invoices/day, cooldown between submissions)
- [x] Backend: IP tracking on invoice submissions
- [x] Backend: failed attempt counter — auto-flag after 5 failed attempts
- [x] Backend: auto-block suspicious accounts after threshold
- [x] Backend: WhatsApp delivery log (save to whatsapp_logs table with retry)
- [x] Backend: WhatsApp resend endpoint for admin
- [x] Backend: Kuwait phone validation (+965, 8 digits after code)
- [x] Backend: prevent duplicate phone accounts on registration
- [x] Admin page: WhatsApp Logs (/admin/whatsapp)
- [x] Admin page: Suspicious Accounts (/admin/suspicious)
- [x] Admin page: Reward Analytics (/admin/analytics)
- [x] Admin: block/unblock suspicious users
- [x] Admin: resend WhatsApp message button
- [x] Admin: reset invoice claim
- [x] UX: better error messages (invoice not found, already used, amount mismatch, suspicious, WhatsApp failure)
- [x] UX: loading states and success animations on invoice submission
- [x] UX: Kuwait phone validation on profile page
- [x] UX: mobile responsiveness improvements
- [x] Remove broken/unused components

## Phase 11: Spin Wheel Eligibility

- [x] Backend: replace daily-spin logic with milestone-based eligibility (1 free spin on registration, then 1 spin per 5 approved invoices)
- [x] Backend: canSpin returns eligibility details (spins used, approved invoices count, next unlock threshold)
- [x] Frontend: update SpinWheel page to show locked state with progress (e.g. "3/5 invoices to next spin")
- [x] Frontend: show "Welcome spin" label for first-time spin
- [x] Tests: update spin eligibility tests

## Phase 12: Official Twilio WhatsApp Integration

- [x] Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM=whatsapp:+15559682683 as env secrets
- [x] Rewrite sendWhatsApp to use official sender, validate credentials on startup
- [x] Add duplicate-send prevention: check whatsapp_logs for existing sent message per invoiceId+messageType before sending
- [x] Add retry logic: exponential backoff, max 3 retries, update retryCount in whatsapp_logs
- [x] Wire auto-send into reviewInvoice: send points_awarded message with customer name, earned points, invoice number, total points
- [x] Add sendWithDuplicateCheck helper that wraps sendWhatsApp with log lookup
- [x] Update admin WhatsApp logs page: show delivery status badge, retry button, mobile-friendly layout
- [x] Add Twilio credential validation test

## Phase 13: Automated Invoice Approval Engine

- [x] Audit invoice submission flow and schema
- [x] Create invoice_registry table: invoiceNumber, customerPhone, amount, date, isUsed, createdBy
- [x] DB function: lookupInvoiceRegistry(invoiceNumber) → returns registry row or null
- [x] DB function: autoApproveInvoice(invoiceId) — matches phone, amount, marks registry as used, approves
- [x] Auto-approval engine: on invoice submit, run match → auto-approve if match, leave pending if phone mismatch or not in registry
- [x] Send WhatsApp on auto-approve (points awarded), notify customer if pending review
- [x] Admin page: Invoice Registry (/admin/registry) — add, delete, search, status
- [x] Add /admin/registry route to App.tsx and nav link to AdminLayout
- [x] Add Auto-Approve button to AdminInvoices.tsx for pending invoices
- [x] Tests: auto-approval matching logic

## Phase 14: QuickBooks Rewards Notification Flow

- [x] Create qb_payment_syncs table (invoiceId, customerId, amount, pointsCalculated, status, processedAt, webhookEventId)
- [x] Create pending_rewards table (phone, customerName, invoiceNumber, amount, pointsEarned, message, status, createdAt, claimedByUserId)
- [x] Create qb_webhook_events table (eventId, eventType, payload, processed, processedAt, error)
- [x] Run DB migrations for new tables
- [x] Build QB webhook receiver: POST /api/qb/webhook (verify signature, parse payment events)
- [x] Build rewards processor: detect paid invoices, extract customer data, calculate points, check duplicates
- [x] Create pending rewards on QB payment: save to pending_rewards table if customer not registered
- [x] Send WhatsApp to new customers: signup invitation with points earned
- [x] Send WhatsApp to existing customers: points added confirmation with balance
- [x] Wire pending rewards into signup flow: auto-claim when customer registers with matching phone
- [x] Add admin QB Sync Logs page: show successful syncs, failed syncs, pending rewards
- [x] Add retry system for failed WhatsApp sends
- [x] Tests: QB event parsing (13 tests passing), point calculation, duplicate prevention, pending rewards claim

## Phase 15: WhatsApp Template-Based Automation

- [x] Update WhatsApp implementation to support template-based messages (sendWhatsAppTemplate)
- [x] Update QB rewards engine to use approved reward_notification template
- [x] Fix Kuwait phone normalization: +965, 00965, 965, 0, local formats with spaces/dashes
- [x] Remove manual approval queue - send templates automatically on QB payment
- [x] Update Twilio webhook to log delivery status to database
- [x] Extend whatsapp_logs schema: add deliveredAt, twilioResponse, update status enum
- [x] Apply database migration for delivery tracking
- [x] Log full Twilio API responses in console for debugging
- [x] Tests: 16 tests passing (phone normalization, template sending, delivery tracking)

## Phase 16: Production Twilio Messaging Service Deployment

- [x] Add TWILIO_MESSAGING_SERVICE_SID to environment secrets
- [x] Update sendWhatsAppTemplate() to use Messaging Service SID instead of sandbox sender
- [x] Update QB rewards engine to use approved reward_test template
- [x] Update all test descriptions to reference reward_test template
- [x] Verify all 16 tests passing with production configuration
- [x] Dev server running and healthy
- [ ] Deploy to production and verify QB payment → WhatsApp delivery
