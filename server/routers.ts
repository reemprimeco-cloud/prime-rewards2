import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getDb,
  upsertUser,
  getUserByOpenId,
  getCustomerByUserId,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getAllCustomers,
  getTotalCustomerCount,
  calculateTier,
  getTierThresholds,
  addPoints,
  getTransactionHistory,
  submitInvoice,
  getInvoicesByCustomer,
  getAllInvoices,
  reviewInvoice,
  getActiveRewards,
  redeemReward,
  getRedemptionsByCustomer,
  getActiveCampaigns,
  getAllCampaigns,
  getAllBadges,
  getCustomerBadges,
  checkAndAwardBadges,
  canSpinToday,
  performSpin,
  getNotifications,
  markNotificationsRead,
  createNotification,
  getFraudFlags,
  createFraudFlag,
  reviewFraudFlag,
  getAdminAnalytics,
  seedDefaultBadges,
  seedDefaultRewards,
  logWhatsApp,
  updateWhatsAppLog,
  getWhatsAppLogs,
  recordFailedAttempt,
  getSuspiciousAccounts,
  blockSuspiciousAccount,
  unblockSuspiciousAccount,
  isCustomerBlocked,
  getCustomerByPhone,
  resetInvoiceClaim,
  getSpinEligibility,
} from "./db";
import { eq, count, desc, and, gte } from "drizzle-orm";
import {
  customers,
  invoices,
  rewards,
  campaigns,
  badges,
  fraudFlags,
  notifications,
} from "../drizzle/schema";
import { nanoid } from "nanoid";
import { lookupQBInvoice, lookupQBInvoiceByPhone, isQBConnected } from "./quickbooks";
import {
  sendWhatsApp,
  sendWhatsAppIfNotDuplicate,
  sendWhatsAppWithRetry,
  welcomeMessage,
  pointsAwardedMessage,
  rewardRedeemedMessage,
  tierUpgradeMessage,
  spinWinMessage,
} from "./whatsapp";

// Admin guard middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Customer Profile ─────────────────────────────────────────────────────
  customer: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      let customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) {
        // Auto-create customer profile on first login
        const referralCode = nanoid(8).toUpperCase();
        customer = await createCustomer({
          userId: ctx.user.id,
          fullName: ctx.user.name ?? "Customer",
          referralCode,
        });
        await seedDefaultBadges();
        await seedDefaultRewards();
        // Send welcome WhatsApp if phone is available
        if (customer.phone) {
          sendWhatsApp(customer.phone, welcomeMessage(customer.fullName, customer.totalPoints)).catch(() => {});
        }
      }
      return customer;
    }),

    update: protectedProcedure
      .input(z.object({
        fullName: z.string().min(1).optional(),
        phone: z.string().optional(),
        businessName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customer = await getCustomerByUserId(ctx.user.id);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });

        // Server-side Kuwait phone validation + duplicate check
        if (input.phone) {
          const cleaned = input.phone.replace(/\s|-/g, "");
          const kuwaitRegex = /^(\+965|00965|965)?[5692][0-9]{7}$/;
          if (!kuwaitRegex.test(cleaned)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid phone number. Please enter a valid Kuwait phone number (e.g. +965 5500 1234).",
            });
          }
          // Prevent duplicate phone numbers across accounts
          const existingWithPhone = await getCustomerByPhone(cleaned);
          if (existingWithPhone && existingWithPhone.id !== customer.id) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "This phone number is already registered to another account. Please use a different number.",
            });
          }
        }

        const hadPhone = !!customer.phone;
        await updateCustomer(customer.id, input);
        const updated = await getCustomerByUserId(ctx.user.id);
        // Send welcome WhatsApp when phone is added for the first time and log it
        if (!hadPhone && input.phone && updated) {
          const msg = welcomeMessage(updated.fullName, updated.totalPoints);
          const logId = await logWhatsApp({
            customerId: updated.id,
            phone: input.phone,
            messageType: "welcome",
            messageBody: msg,
            status: "pending",
          });
          const waResult = await sendWhatsApp(input.phone, msg).catch(() => ({ success: false, error: "send failed" }));
          if (logId) {
            await updateWhatsAppLog(logId, {
              status: waResult.success ? "sent" : "failed",
              messageSid: (waResult as any).messageSid,
              errorMessage: (waResult as any).error,
            }).catch(() => {});
          }
        }
        return updated;
      }),

    tierInfo: protectedProcedure.query(async ({ ctx }) => {
      const customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      const thresholds = getTierThresholds();
      const tierOrder = ["Bronze", "Silver", "Gold", "Platinum"] as const;
      const currentIndex = tierOrder.indexOf(customer.tier);
      const nextTier = tierOrder[currentIndex + 1];
      const nextThreshold = nextTier ? thresholds[nextTier] : null;
      const progress = nextThreshold
        ? Math.min(100, Math.floor((customer.lifetimePoints / nextThreshold) * 100))
        : 100;
      return { customer, thresholds, nextTier, nextThreshold, progress };
    }),
  }),

  // ─── Transactions ─────────────────────────────────────────────────────────
  transactions: router({
    history: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        const customer = await getCustomerByUserId(ctx.user.id);
        if (!customer) return [];
        return getTransactionHistory(customer.id, input.limit);
      }),
  }),

  // ─── Invoices ─────────────────────────────────────────────────────────────
  invoices: router({
    // Check QB connection status (used by invoice form)
    qbStatus: publicProcedure.query(() => ({
      connected: isQBConnected(),
    })),

    // Look up invoice by invoice number OR phone — returns invoice details including amount
    lookup: protectedProcedure
      .input(z.object({
        query: z.string().min(1),  // invoice number or phone number
        type: z.enum(["invoice", "phone"]),
      }))
      .mutation(async ({ input }) => {
        if (!isQBConnected()) {
          return { found: false, reason: "QB_NOT_CONNECTED", message: "QuickBooks is not connected. Enter amount manually.", invoices: [] };
        }

        if (input.type === "invoice") {
          const result = await lookupQBInvoice(input.query);
          if (!result.found) {
            return { found: false, reason: "NOT_FOUND", message: result.errorMessage ?? "Invoice not found in QuickBooks.", invoices: [] };
          }
          return {
            found: true,
            reason: result.status === "unpaid" ? "UNPAID" : "OK",
            message: result.status === "unpaid"
              ? "Invoice found but is still unpaid. Points are awarded after payment."
              : "Invoice verified in QuickBooks.",
            invoices: [{
              invoiceNumber: result.invoice!.DocNumber,
              customerName: result.customerName ?? "",
              totalAmount: result.totalAmount ?? 0,
              status: result.status,
              date: result.invoice!.TxnDate,
            }],
          };
        } else {
          // Phone lookup — returns multiple invoices
          const results = await lookupQBInvoiceByPhone(input.query);
          if (results.length === 0) {
            return { found: false, reason: "NOT_FOUND", message: "No invoices found for this phone number.", invoices: [] };
          }
          return {
            found: true,
            reason: "OK",
            message: `Found ${results.length} invoice(s) for this phone number.`,
            invoices: results.map(r => ({
              invoiceNumber: r.invoice!.DocNumber,
              customerName: r.customerName ?? "",
              totalAmount: r.totalAmount ?? 0,
              status: r.status,
              date: r.invoice!.TxnDate,
            })),
          };
        }
      }),

    // Validate an invoice number against QuickBooks before submitting (legacy)
    validateQB: protectedProcedure
      .input(z.object({ invoiceNumber: z.string().min(1) }))
      .mutation(async ({ input }) => {
        if (!isQBConnected()) {
          return { validated: false, reason: "QB_NOT_CONNECTED", message: "QuickBooks is not connected. Invoice will be submitted for manual review." };
        }
        const result = await lookupQBInvoice(input.invoiceNumber);
        if (!result.found) {
          return { validated: false, reason: "NOT_FOUND", message: result.errorMessage ?? "Invoice not found in QuickBooks." };
        }
        if (result.status === "unpaid") {
          return { validated: false, reason: "UNPAID", message: "This invoice is still unpaid in QuickBooks. Points are awarded after payment." };
        }
        return {
          validated: true,
          reason: "OK",
          message: "Invoice verified in QuickBooks.",
          customerName: result.customerName,
          totalAmount: result.totalAmount,
          status: result.status,
        };
      }),

    submit: protectedProcedure
      .input(z.object({
        invoiceNumber: z.string().min(1),
        invoiceAmount: z.number().positive().optional(),  // optional — auto-filled from QB
        skipQBValidation: z.boolean().optional().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const customer = await getCustomerByUserId(ctx.user.id);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });

        // Capture client IP for fraud tracking
        const clientIp: string =
          (ctx.req as any)?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
          (ctx.req as any)?.socket?.remoteAddress ||
          "unknown";

        // Block check — prevent blocked accounts from submitting
        const blocked = await isCustomerBlocked(customer.id);
        if (blocked) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your account has been flagged for suspicious activity. Please contact support.",
          });
        }

        // QuickBooks validation (if connected)
        let qbValidated = false;
        let qbCustomerName: string | undefined;
        let resolvedAmount: number = input.invoiceAmount ?? 0;

        let pendingReview = false; // set true for unpaid invoices — go to admin review

        if (isQBConnected() && !input.skipQBValidation) {
          const qbResult = await lookupQBInvoice(input.invoiceNumber);

          // Token expired — surface a clear reconnect message
          if (qbResult.tokenExpired) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "QuickBooks authorization has expired. Please ask an admin to re-authorize QuickBooks in Admin → Settings.",
            });
          }

          if (!qbResult.found) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invoice not found in QuickBooks. Please check the invoice number.",
            });
          }

          if (qbResult.status === "unpaid" || qbResult.status === "partial") {
            // Allow submission but flag for admin review — points awarded after admin approval
            pendingReview = true;
          }

          qbValidated = true;
          qbCustomerName = qbResult.customerName;
          // Always use QB amount as the authoritative source
          if (qbResult.totalAmount) {
            resolvedAmount = qbResult.totalAmount;
          }
        }

        if (!resolvedAmount || resolvedAmount <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invoice amount could not be determined. Please enter the amount manually.",
          });
        }

        try {
          const invoice = await submitInvoice({
            customerId: customer.id,
            invoiceNumber: input.invoiceNumber,
            invoiceAmount: resolvedAmount,
            source: qbValidated ? "quickbooks" : "manual",
            pendingReview,
          });
          return { ...invoice, qbValidated, qbCustomerName, pendingReview };
        } catch (err: any) {
          if (err.message === "DUPLICATE_INVOICE") {
            // Log the failed attempt
            await recordFailedAttempt({
              customerId: customer.id,
              attemptType: "duplicate_invoice",
              invoiceNumber: input.invoiceNumber,
              details: "Customer attempted to submit a duplicate invoice number",
              ipAddress: clientIp,
            }).catch(() => {});
            throw new TRPCError({ code: "CONFLICT", message: "This invoice number has already been submitted." });
          }
          if (err.message === "RATE_LIMIT_EXCEEDED") {
            await recordFailedAttempt({
              customerId: customer.id,
              attemptType: "rate_limit",
              invoiceNumber: input.invoiceNumber,
              details: "Customer exceeded daily invoice submission limit",
              ipAddress: clientIp,
            }).catch(() => {});
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You can submit a maximum of 5 invoices per day." });
          }
          throw err;
        }
      }),

    myInvoices: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        const customer = await getCustomerByUserId(ctx.user.id);
        if (!customer) return [];
        return getInvoicesByCustomer(customer.id, input.limit);
      }),

    // Admin
    all: adminProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
      .query(async ({ input }) => getAllInvoices(undefined, input.limit, input.offset)),

    review: adminProcedure
      .input(z.object({
        invoiceId: z.number(),
        status: z.enum(["approved", "rejected", "flagged"]),
        rejectionReason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await reviewInvoice(input.invoiceId, input.status, ctx.user.id, input.rejectionReason);
        // Auto-send WhatsApp on approval — with duplicate prevention and retry
        if (input.status === "approved" && result) {
          // Fire-and-forget so the admin response is not blocked
          (async () => {
            try {
              const db2 = await getDb();
              const { invoices: invTable } = await import("../drizzle/schema");
              const { eq: eqOp } = await import("drizzle-orm");
              const invRows = db2 ? await db2.select().from(invTable).where(eqOp(invTable.id, input.invoiceId)).limit(1) : [];
              const inv = invRows[0];
              const customer = await getCustomerById((result as any).customerId ?? inv?.customerId);
              if (customer?.phone && inv) {
                const msg = pointsAwardedMessage(
                  customer.fullName,
                  inv.pointsEarned ?? 0,
                  customer.totalPoints,
                  inv.invoiceNumber ?? "",
                  parseFloat(inv.invoiceAmount ?? "0")
                );
                // sendWhatsAppIfNotDuplicate handles: duplicate check, logging, retry (up to 3x)
                await sendWhatsAppIfNotDuplicate({
                  toPhone: customer.phone,
                  message: msg,
                  customerId: customer.id,
                  messageType: "points_awarded",
                  invoiceId: inv.id,
                });
              }
            } catch (e) {
              console.error("[WhatsApp] Invoice approval notification failed:", e);
            }
          })();
        }
        return result;
      }),

    resetClaim: adminProcedure
      .input(z.object({ invoiceId: z.number() }))
      .mutation(async ({ input }) => {
        await resetInvoiceClaim(input.invoiceId);
        return { success: true };
      }),
  }),

  // ─── Rewards ───────────────────────────────────────────────────────────
  rewards: router({
    list: publicProcedure.query(() => getActiveRewards()),

    redeem: protectedProcedure
      .input(z.object({ rewardId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const customer = await getCustomerByUserId(ctx.user.id);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        try {
          const result = await redeemReward(customer.id, input.rewardId);
          // Send WhatsApp notification for reward redemption
          if (customer.phone && result) {
            const r = result as any;
            const updatedCustomer = await getCustomerByUserId(ctx.user.id);
            sendWhatsApp(
              customer.phone,
              rewardRedeemedMessage(
                customer.fullName,
                r.rewardName ?? "Reward",
                r.requiredPoints ?? 0,
                updatedCustomer?.totalPoints ?? 0,
                r.couponCode
              )
            ).catch(() => {});
          }
          return result;
        } catch (err: any) {
          if (err.message === "INSUFFICIENT_POINTS") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough points to redeem this reward." });
          }
          throw err;
        }
      }),

    myRedemptions: protectedProcedure.query(async ({ ctx }) => {
      const customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) return [];
      return getRedemptionsByCustomer(customer.id);
    }),

    // Admin
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        requiredPoints: z.number().positive(),
        rewardType: z.enum(["discount", "free_service", "merchandise", "free_delivery", "free_design", "double_points"]),
        discountValue: z.number().optional(),
        stock: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(rewards).values({
          ...input,
          discountValue: input.discountValue ? String(input.discountValue) : undefined,
        } as any);
        return { success: true };
      }),

    toggle: adminProcedure
      .input(z.object({ rewardId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(rewards).set({ isActive: input.isActive }).where(eq(rewards.id, input.rewardId));
        return { success: true };
      }),

    allAdmin: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(rewards).orderBy(desc(rewards.createdAt));
    }),
  }),

  // ─── Campaigns ────────────────────────────────────────────────────────────
  campaigns: router({
    active: publicProcedure.query(() => getActiveCampaigns()),
    all: adminProcedure.query(() => getAllCampaigns()),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        multiplier: z.number().min(1).max(10),
        bonusPoints: z.number().optional(),
        startDate: z.string(),
        endDate: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(campaigns).values({
          ...input,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          createdBy: ctx.user.id,
        });
        return { success: true };
      }),

    toggle: adminProcedure
      .input(z.object({ campaignId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(campaigns).set({ isActive: input.isActive }).where(eq(campaigns.id, input.campaignId));
        return { success: true };
      }),
  }),

  // ─── Badges ───────────────────────────────────────────────────────────────
  badges: router({
    all: publicProcedure.query(() => getAllBadges()),

    mine: protectedProcedure.query(async ({ ctx }) => {
      const customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) return [];
      return getCustomerBadges(customer.id);
    }),
  }),

  // ─── Spin Wheel ───────────────────────────────────────────────────────────
  spin: router({
    canSpin: protectedProcedure.query(async ({ ctx }) => {
      const customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) return { canSpin: false, totalSpinsEarned: 0, totalSpinsUsed: 0, spinsRemaining: 0, approvedInvoiceCount: 0, nextUnlockAt: 5, isWelcomeSpin: false };
      return getSpinEligibility(customer.id);
    }),

    spin: protectedProcedure.mutation(async ({ ctx }) => {
      const customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        const result = await performSpin(customer.id);
        // Send WhatsApp notification for spin win
        if (customer.phone && result) {
          const r = result as any;
          const prize = r.prize ?? r.label ?? "a prize";
          const pointsWon = r.pointsWon ?? r.points ?? 0;
          sendWhatsApp(
            customer.phone,
            spinWinMessage(customer.fullName, prize, pointsWon > 0 ? pointsWon : undefined)
          ).catch(() => {});
        }
        return result;
      } catch (err: any) {
        if (err.message === "SPIN_NOT_AVAILABLE" || err.message === "ALREADY_SPUN_TODAY") {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "No spins available. Submit 5 approved invoices to unlock your next spin!" });
        }
        throw err;
      }
    }),
  }),

  // ─── Notifications ────────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) return [];
      return getNotifications(customer.id);
    }),

    markRead: protectedProcedure.mutation(async ({ ctx }) => {
      const customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) return;
      await markNotificationsRead(customer.id);
      return { success: true };
    }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) return 0;
      const db = await getDb();
      if (!db) return 0;
      const result = await db
        .select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.customerId, customer.id), eq(notifications.isRead, false)));
      return result[0]?.count ?? 0;
    }),
  }),

  // ─── Fraud ────────────────────────────────────────────────────────────────
  fraud: router({
    flags: adminProcedure.query(() => getFraudFlags()),

    list: adminProcedure
      .input(z.object({
        status: z.enum(["open", "reviewed", "dismissed"]).optional(),
        limit: z.number().default(100),
      }))
      .query(async ({ input }) => {
        const flags = await getFraudFlags(input.status);
        return flags.slice(0, input.limit);
      }),

    review: adminProcedure
      .input(z.object({
        flagId: z.number(),
        status: z.enum(["reviewed", "dismissed"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await reviewFraudFlag(input.flagId, input.status, ctx.user.id);
        return { success: true };
      }),

    flag: adminProcedure
      .input(z.object({
        customerId: z.number(),
        invoiceId: z.number().optional(),
        reason: z.enum(["duplicate_invoice", "excessive_submissions", "suspicious_amount", "manual_flag"]),
        details: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await createFraudFlag(input);
        return { success: true };
      }),
  }),

  // ─── Admin ────────────────────────────────────────────────────────────────
  admin: router({
    analytics: adminProcedure.query(() => getAdminAnalytics()),

    customers: adminProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
      .query(({ input }) => getAllCustomers(input.limit, input.offset)),

    adjustPoints: adminProcedure
      .input(z.object({
        customerId: z.number(),
        points: z.number(),
        reason: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await addPoints(
          input.customerId,
          input.points,
          "manual",
          `Admin adjustment: ${input.reason}`,
          undefined,
          "admin"
        );
        await createNotification(
          input.customerId,
          "points_added",
          input.points > 0 ? "Points Added by Admin" : "Points Adjusted",
          `${Math.abs(input.points)} points have been ${input.points > 0 ? "added to" : "deducted from"} your account. Reason: ${input.reason}`
        );
        // Send WhatsApp notification for manual point adjustment
        if (input.points > 0) {
          try {
            const customer = await getCustomerById(input.customerId);
            if (customer?.phone) {
              const updatedCustomer = await getCustomerById(input.customerId);
              sendWhatsApp(
                customer.phone,
                [
                  `💰 *تم إضافة النقاط! / Points Added!*`,
                  ``,
                  `مرحباً ${customer.fullName},`,
                  `Hello ${customer.fullName},`,
                  ``,
                  `🎉 تمت إضافة *${input.points} نقطة* إلى حسابك.`,
                  `🎉 *${input.points} points* have been added to your account.`,
                  ``,
                  `السبب / Reason: ${input.reason}`,
                  ``,
                  `💰 إجمالي نقاطك / Total Points: *${updatedCustomer?.totalPoints ?? 0}*`,
                ].join("\n")
              ).catch(() => {});
            }
          } catch {}
        }
        return result;
      }),

    customerDetail: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        const customer = await getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        const [transactions, invoiceList, badgeList] = await Promise.all([
          getTransactionHistory(input.customerId, 20),
          getInvoicesByCustomer(input.customerId, 20),
          getCustomerBadges(input.customerId),
        ]);
        return { customer, transactions, invoices: invoiceList, badges: badgeList };
      }),

    createReward: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        requiredPoints: z.number().min(1),
        rewardType: z.enum(["discount", "free_service", "merchandise", "free_delivery", "free_design", "double_points"]),
        rewardValue: z.number().optional(),
        stock: z.number().default(-1),
        minTier: z.enum(["Bronze", "Silver", "Gold", "Platinum"]).default("Bronze"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(rewards).values({
          name: input.name,
          description: input.description ?? null,
          requiredPoints: input.requiredPoints,
          rewardType: input.rewardType,
          discountValue: input.rewardValue ? String(input.rewardValue) : null,
          stock: input.stock === -1 ? null : input.stock,
          isActive: true,
        });
        return { success: true };
      }),

    deleteReward: adminProcedure
      .input(z.object({ rewardId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(rewards).set({ isActive: false }).where(eq(rewards.id, input.rewardId));
        return { success: true };
      }),

    updateReward: adminProcedure
      .input(z.object({
        rewardId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        requiredPoints: z.number().min(1),
        rewardType: z.enum(["discount", "free_service", "merchandise", "free_delivery", "free_design", "double_points"]),
        rewardValue: z.number().optional(),
        stock: z.number().default(-1),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(rewards).set({
          name: input.name,
          description: input.description ?? null,
          requiredPoints: input.requiredPoints,
          rewardType: input.rewardType,
          discountValue: input.rewardValue ? String(input.rewardValue) : null,
          stock: input.stock === -1 ? null : input.stock,
        }).where(eq(rewards.id, input.rewardId));
        return { success: true };
      }),

    toggleReward: adminProcedure
      .input(z.object({ rewardId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(rewards).set({ isActive: input.isActive }).where(eq(rewards.id, input.rewardId));
        return { success: true };
      }),

    createCampaign: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        multiplier: z.number().min(1).max(10),
        bonusPoints: z.number().optional(),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(campaigns).values({
          name: input.name,
          description: input.description ?? null,
          multiplier: input.multiplier,
          bonusPoints: input.bonusPoints ?? null,
          startDate: input.startDate,
          endDate: input.endDate,
          isActive: true,
        });
        return { success: true };
      }),

    deleteCampaign: adminProcedure
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(campaigns).set({ isActive: false }).where(eq(campaigns.id, input.campaignId));
        return { success: true };
      }),

    seedData: adminProcedure.mutation(async () => {
      await seedDefaultBadges();
      await seedDefaultRewards();
      return { success: true };
    }),
  }),

  // ─── WhatsApp Logs ─────────────────────────────────────────────────────────────
  whatsappLogs: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
      .query(({ input }) => getWhatsAppLogs(input.limit, input.offset)),

    resend: adminProcedure
      .input(z.object({ logId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { whatsappLogs: wlTable } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const rows = await db.select().from(wlTable).where(eqOp(wlTable.id, input.logId)).limit(1);
        const log = rows[0];
        if (!log) throw new TRPCError({ code: "NOT_FOUND" });
        // Mark as retrying before attempting
        await updateWhatsAppLog(log.id, { status: "retrying", retryCount: (log.retryCount ?? 0) + 1 });
        // Use retry-capable send (up to 3 attempts with backoff)
        const result = await sendWhatsAppWithRetry(log.phone, log.messageBody, log.id);
        return { success: result.success };
      }),
  }),

  // ─── Suspicious Accounts ─────────────────────────────────────────────────────
  suspicious: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(({ input }) => getSuspiciousAccounts(input.limit)),

    block: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await blockSuspiciousAccount(input.customerId, ctx.user.id);
        return { success: true };
      }),

    unblock: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await unblockSuspiciousAccount(input.customerId, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
