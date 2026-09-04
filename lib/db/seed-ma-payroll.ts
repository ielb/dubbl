/**
 * Configure an existing organization for Moroccan payroll: sets
 * payrollSettings.country = "MA" (the CNSS/AMO rate columns already default
 * to the correct 2026 statutory rates — see lib/db/schema/payroll.ts) and
 * seeds the 2026 IR bracket schedule into taxBracket.
 *
 * Not wired into any UI or automatic trigger — a Moroccan payroll settings
 * UI is explicitly out of scope for this phase (issue #4). Callable directly
 * (e.g. from a one-off script) once an org needs to be configured for
 * Moroccan payroll.
 */
import { db } from "@/lib/db";
import { payrollSettings, taxBracket } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type DbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

const MA_IR_TAX_YEAR = 2026;

/** 2026 Moroccan IR schedule (Loi de Finances 2026 / Law 50-25, DGI circular note 737 — verify before production use). */
export const MA_IR_BRACKETS_2026: {
  minIncome: number;
  maxIncome: number | null;
  rate: number;
}[] = [
  { minIncome: 0, maxIncome: 4_000_000, rate: 0 }, // 0–40,000 MAD/year: 0%
  { minIncome: 4_000_000, maxIncome: 6_000_000, rate: 1000 }, // 40k–60k: 10%
  { minIncome: 6_000_000, maxIncome: 8_000_000, rate: 2000 }, // 60k–80k: 20%
  { minIncome: 8_000_000, maxIncome: 10_000_000, rate: 3000 }, // 80k–100k: 30%
  { minIncome: 10_000_000, maxIncome: 18_000_000, rate: 3400 }, // 100k–180k: 34%
  { minIncome: 18_000_000, maxIncome: null, rate: 3700 }, // above 180k: 37%
];

/** Idempotent: does nothing if this org's MA brackets are already seeded. */
export async function seedMoroccanPayrollConfig(
  organizationId: string,
  exec: DbOrTx = db
): Promise<void> {
  await exec
    .update(payrollSettings)
    .set({ country: "MA" })
    .where(eq(payrollSettings.organizationId, organizationId));

  const existing = await exec.query.taxBracket.findMany({
    where: and(
      eq(taxBracket.organizationId, organizationId),
      eq(taxBracket.jurisdictionLevel, "federal"),
      eq(taxBracket.taxYear, MA_IR_TAX_YEAR)
    ),
  });
  if (existing.length > 0) return;

  await exec.insert(taxBracket).values(
    MA_IR_BRACKETS_2026.map((b) => ({
      organizationId,
      name: "Morocco IR 2026",
      jurisdictionLevel: "federal" as const,
      filingStatus: null,
      taxYear: MA_IR_TAX_YEAR,
      minIncome: b.minIncome,
      maxIncome: b.maxIncome,
      rate: b.rate,
      baseAmountCents: null,
      isActive: true,
    }))
  );
}
