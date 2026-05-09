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
