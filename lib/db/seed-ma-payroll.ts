/**
 * Configure an existing organization for Moroccan payroll: sets
 * payrollSettings.country = "MA" (the CNSS/AMO rate columns already default
 * to the correct 2026 statutory rates — see lib/db/schema/payroll.ts) and
 * seeds the 2026 IR bracket schedule into taxBracket.
 *
 * Used by the payroll-settings REST and MCP operations when an organization
 * switches its payroll country to Morocco.
 */
import { db } from "@/lib/db";
import { payrollSettings, taxBracket } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type DbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

const MA_IR_TAX_YEAR = 2026;

/**
 * Moroccan IR bracket schedule, in force for tax year 2026. The brackets
 * themselves were set by Loi de Finances 2025 (Law 60-24) and left unchanged
 * by LF2026/Law 50-25 (confirmed against the Ministry of Finance's official
 * LF2025 fiscal-measures summary and DGI note circulaire n°737) — still
 * current for 2026, just not a "2026" change despite the variable name.
 */
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

/** Idempotent: inserts only Moroccan bracket rows that are not already present. */
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
      eq(taxBracket.taxYear, MA_IR_TAX_YEAR),
      eq(taxBracket.name, "Morocco IR 2026")
    ),
  });

  const existingKeys = new Set(
    existing.map(
      (row) => `${row.minIncome}:${row.maxIncome ?? "open"}:${row.rate}`
    )
  );
  const missingBrackets = MA_IR_BRACKETS_2026.filter(
    (row) =>
      !existingKeys.has(
        `${row.minIncome}:${row.maxIncome ?? "open"}:${row.rate}`
      )
  );
  if (missingBrackets.length === 0) return;

  await exec.insert(taxBracket).values(
    missingBrackets.map((b) => ({
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
