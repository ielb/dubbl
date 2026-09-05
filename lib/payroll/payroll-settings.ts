import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payrollSettings } from "@/lib/db/schema";
import { seedMoroccanPayrollConfig } from "@/lib/db/seed-ma-payroll";

export interface PayrollSettingsUpdate {
  defaultTaxRate?: number;
  overtimeThresholdHours?: number;
  overtimeMultiplier?: number;
  defaultCurrency?: string;
  salaryExpenseAccountCode?: string;
  taxPayableAccountCode?: string;
  bankAccountCode?: string;
  autoApprovalEnabled?: boolean;
  country?: "US" | "MA";
}

export async function getOrCreatePayrollSettings(organizationId: string) {
  const existing = await db.query.payrollSettings.findFirst({
    where: eq(payrollSettings.organizationId, organizationId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(payrollSettings)
    .values({ organizationId })
    .returning();
  return created;
}

/** Persist settings and seed Morocco's IR schedule in the same transaction. */
export async function updatePayrollSettings(
  organizationId: string,
  updates: PayrollSettingsUpdate
) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.payrollSettings.findFirst({
      where: eq(payrollSettings.organizationId, organizationId),
    });

    const [settings] = existing
      ? await tx
          .update(payrollSettings)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(payrollSettings.organizationId, organizationId))
          .returning()
      : await tx
          .insert(payrollSettings)
          .values({ organizationId, ...updates })
          .returning();

    if (updates.country === "MA" && existing?.country !== "MA") {
      await seedMoroccanPayrollConfig(organizationId, tx);
    }

    return settings;
  });
}
