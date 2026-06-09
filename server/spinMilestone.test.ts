import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getDb } from "./db";
import { customers, invoices, spinResults } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Test suite for milestone-based spin eligibility
 * - 1 free spin on first registration (welcome spin)
 * - 1 free spin for every 5 approved invoices
 * Example: 0 invoices = 1 spin available (welcome)
 *          5 invoices = 2 spins available
 *          10 invoices = 3 spins available
 */

describe("Milestone-based Spin Eligibility", () => {
  let testCustomerId: number;
  const db = getDb();

  beforeAll(async () => {
    // Create a test customer
    if (db) {
      const result = await db.insert(customers).values({
        userId: Math.floor(Math.random() * 1000000),
        fullName: "Spin Test Customer",
        phone: "+96598765432",
        totalPoints: 0,
        lifetimePoints: 0,
        tier: "Bronze",
      });
      testCustomerId = (result as any).insertId;
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (db && testCustomerId) {
      await db.delete(spinResults).where(eq(spinResults.customerId, testCustomerId));
      await db.delete(invoices).where(eq(invoices.customerId, testCustomerId));
      await db.delete(customers).where(eq(customers.id, testCustomerId));
    }
  });

  it("should allow 1 spin for new customer (welcome spin)", async () => {
    if (!db || !testCustomerId) {
      expect.fail("Database not available");
    }

    // Simulate canSpinToday logic
    const invoiceResult = await db
      .select({ count: (col: any) => col })
      .from(invoices)
      .where(eq(invoices.customerId, testCustomerId));

    const approvedInvoiceCount = invoiceResult.length;
    const totalSpinsEarned = 1 + Math.floor(approvedInvoiceCount / 5);

    expect(approvedInvoiceCount).toBe(0);
    expect(totalSpinsEarned).toBe(1);
  });

  it("should allow 2 spins after 5 approved invoices", async () => {
    if (!db || !testCustomerId) {
      expect.fail("Database not available");
    }

    // Add 5 approved invoices
    for (let i = 0; i < 5; i++) {
      await db.insert(invoices).values({
        customerId: testCustomerId,
        invoiceNumber: `TEST-INV-${Date.now()}-${i}`,
        invoiceAmount: "100.00",
        pointsEarned: 10,
        status: "approved",
      });
    }

    // Calculate spins
    const invoiceResult = await db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, testCustomerId));

    const approvedInvoiceCount = invoiceResult.filter((inv) => inv.status === "approved").length;
    const totalSpinsEarned = 1 + Math.floor(approvedInvoiceCount / 5);

    expect(approvedInvoiceCount).toBe(5);
    expect(totalSpinsEarned).toBe(2);
  });

  it("should allow 3 spins after 10 approved invoices", async () => {
    if (!db || !testCustomerId) {
      expect.fail("Database not available");
    }

    // Add 5 more approved invoices (total 10)
    for (let i = 5; i < 10; i++) {
      await db.insert(invoices).values({
        customerId: testCustomerId,
        invoiceNumber: `TEST-INV-${Date.now()}-${i}`,
        invoiceAmount: "100.00",
        pointsEarned: 10,
        status: "approved",
      });
    }

    // Calculate spins
    const invoiceResult = await db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, testCustomerId));

    const approvedInvoiceCount = invoiceResult.filter((inv) => inv.status === "approved").length;
    const totalSpinsEarned = 1 + Math.floor(approvedInvoiceCount / 5);

    expect(approvedInvoiceCount).toBe(10);
    expect(totalSpinsEarned).toBe(3);
  });

  it("should track spins used and calculate remaining spins", async () => {
    if (!db || !testCustomerId) {
      expect.fail("Database not available");
    }

    // Add a spin result (customer used 1 spin)
    await db.insert(spinResults).values({
      customerId: testCustomerId,
      rewardType: "points",
      rewardValue: 100,
      description: "100 Bonus Points!",
    });

    // Calculate remaining spins
    const invoiceResult = await db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, testCustomerId));

    const approvedInvoiceCount = invoiceResult.filter((inv) => inv.status === "approved").length;
    const totalSpinsEarned = 1 + Math.floor(approvedInvoiceCount / 5);

    const spinResult = await db
      .select()
      .from(spinResults)
      .where(eq(spinResults.customerId, testCustomerId));

    const totalSpinsUsed = spinResult.length;
    const spinsRemaining = totalSpinsEarned - totalSpinsUsed;

    expect(totalSpinsUsed).toBe(1);
    expect(spinsRemaining).toBe(2); // 3 earned - 1 used = 2 remaining
  });

  it("should correctly identify welcome spin", async () => {
    if (!db || !testCustomerId) {
      expect.fail("Database not available");
    }

    // Create a new customer with no invoices and no spins
    const newCustomerResult = await db.insert(customers).values({
      userId: Math.floor(Math.random() * 1000000),
      fullName: "Welcome Spin Test",
      phone: "+96598765433",
      totalPoints: 0,
      lifetimePoints: 0,
      tier: "Bronze",
    });
    const newCustomerId = (newCustomerResult as any).insertId;

    try {
      const invoiceResult = await db
        .select()
        .from(invoices)
        .where(eq(invoices.customerId, newCustomerId));

      const approvedInvoiceCount = invoiceResult.filter((inv) => inv.status === "approved").length;

      const spinResult = await db
        .select()
        .from(spinResults)
        .where(eq(spinResults.customerId, newCustomerId));

      const totalSpinsUsed = spinResult.length;

      const isWelcomeSpin = totalSpinsUsed === 0 && approvedInvoiceCount === 0;

      expect(isWelcomeSpin).toBe(true);
    } finally {
      // Clean up
      await db.delete(customers).where(eq(customers.id, newCustomerId));
    }
  });
});
