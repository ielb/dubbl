/**
 * Payslip generation utilities.
 * Computes YTD values and deduction breakdowns for payslip rendering.
 */
import { db } from "@/lib/db";
import { payrollItemTaxBreakdown } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

type DbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

interface PayslipInput {
  employeeId: string;
  grossAmount: number;
  netAmount: number;
  taxAmount: number;
  deductions: { name: string; amount: number; category: string }[];
}

interface YtdValues {
  ytdGross: number;
  ytdNet: number;
  ytdTax: number;
}

export interface PayslipData {
  employeeId: string;
  grossAmount: number;
  netAmount: number;
  taxAmount: number;
  deductionsBreakdown: { name: string; amount: number; category: string }[];
  ytdGross: number;
  ytdNet: number;
  ytdTax: number;
}

/** Build payslip data by combining current item with YTD values */
export function buildPayslipData(
  input: PayslipInput,
  ytd: YtdValues
): PayslipData {
  return {
    employeeId: input.employeeId,
    grossAmount: input.grossAmount,
    netAmount: input.netAmount,
    taxAmount: input.taxAmount,
    deductionsBreakdown: input.deductions,
    ytdGross: ytd.ytdGross,
    ytdNet: ytd.ytdNet,
    ytdTax: ytd.ytdTax,
  };
}

/** Human-readable label for each taxKind persisted by computeEmployeeWithholding. */
const TAX_KIND_LABELS: Record<string, string> = {
  income_tax: "Income Tax",
  social_security: "Social Security",
  medicare: "Medicare",
  additional_medicare: "Additional Medicare",
  cnss_pension: "CNSS - Retraite",
  cnss_ct: "CNSS - Court terme",
  cnss_ipe: "CNSS - IPE",
  amo: "AMO",
};

function humanizeTaxKind(taxKind: string): string {
  return (
    TAX_KIND_LABELS[taxKind] ??
    taxKind
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

/**
 * Map persisted payrollItemTaxBreakdown rows (employee-side only — a payslip
 * shows what's deducted from the employee, not the employer's separate cost)
 * into the {name, amount, category} shape the payslip's deductionsBreakdown
 * column and its UI consumer expect.
 */
export function taxBreakdownToDeductionLines(
  rows: { taxKind: string; amount: number }[]
): { name: string; amount: number; category: string }[] {
  return rows.map((r) => ({
    name: humanizeTaxKind(r.taxKind),
    amount: r.amount,
    category: "tax",
  }));
}

/**
 * Load every persisted payrollItemTaxBreakdown row for a set of payroll items
 * in one query, grouped by payrollItemId. Shared by the REST generate-payslips
 * route and the equivalent MCP tool so the fetch isn't duplicated in both.
 */
export async function loadTaxBreakdownByItem(
  itemIds: string[],
  exec: DbOrTx = db
): Promise<Map<string, { taxKind: string; amount: number }[]>> {
  const rows =
    itemIds.length > 0
      ? await exec
          .select({
            payrollItemId: payrollItemTaxBreakdown.payrollItemId,
            taxKind: payrollItemTaxBreakdown.taxKind,
            amount: payrollItemTaxBreakdown.amount,
          })
          .from(payrollItemTaxBreakdown)
          .where(inArray(payrollItemTaxBreakdown.payrollItemId, itemIds))
      : [];

  const byItem = new Map<string, { taxKind: string; amount: number }[]>();
  for (const row of rows) {
    const list = byItem.get(row.payrollItemId) ?? [];
    list.push({ taxKind: row.taxKind, amount: row.amount });
    byItem.set(row.payrollItemId, list);
  }
  return byItem;
}
