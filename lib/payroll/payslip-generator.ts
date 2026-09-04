/**
 * Payslip generation utilities.
 * Computes YTD values and deduction breakdowns for payslip rendering.
 */

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
