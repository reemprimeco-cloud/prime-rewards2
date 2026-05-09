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
        await updateCustomer(customer.id, input);
        return getCustomerByUserId(ctx.user.id);
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
    submit: protectedProcedure
      .input(z.object({
        invoiceNumber: z.string().min(1),
        invoiceAmount: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customer = await getCustomerByUserId(ctx.user.id);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });

        try {
          const invoice = await submitInvoice({
            customerId: customer.id,
            invoiceNumber: input.invoiceNumber,
            invoiceAmount: input.invoiceAmount,
          });
          return invoice;
        } catch (err: any) {
          if (err.message === "DUPLICATE_INVOICE") {
            throw new TRPCError({ code: "CONFLICT", message: "This invoice number has already been submitted." });
          }
          if (err.message === "RATE_LIMIT_EXCEEDED") {
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
        return reviewInvoice(input.invoiceId, input.status, ctx.user.id, input.rejectionReason);
      }),
  }),

  // ─── Rewards ──────────────────────────────────────────────────────────────
  rewards: router({
    list: publicProcedure.query(() => getActiveRewards()),

    redeem: protectedProcedure
      .input(z.object({ rewardId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const customer = await getCustomerByUserId(ctx.user.id);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        try {
          return redeemReward(customer.id, input.rewardId);
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
      if (!customer) return { canSpin: false };
      const eligible = await canSpinToday(customer.id);
      return { canSpin: eligible };
    }),

    spin: protectedProcedure.mutation(async ({ ctx }) => {
      const customer = await getCustomerByUserId(ctx.user.id);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        return performSpin(customer.id);
      } catch (err: any) {
        if (err.message === "ALREADY_SPUN_TODAY") {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You've already used your daily spin. Come back tomorrow!" });
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
});

export type AppRouter = typeof appRouter;
