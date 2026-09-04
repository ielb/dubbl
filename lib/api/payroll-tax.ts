/**
 * Pure payroll-tax math — no DB access, so it is fully unit-testable.
 *
 * All monetary amounts are integer cents. Rates are basis points
 * (10000 bp = 100%). Every result is rounded to whole cents with Math.round
 * and guarded against divide-by-zero / negative inputs.
 *
 * The progressive engine implements the IRS Pub 15-T "Percentage Method":
 *   1. Annualize the period wage (periodWage × payPeriodsPerYear).
 *   2. Subtract the standard deduction and the value of withholding allowances
 *      to get the annual taxable wage.
 *   3. Walk the MARGINAL brackets to get the tentative annual tax:
 *        tax = baseAmountCents + (annualWage − bracketFloor) × rate
 *      where baseAmountCents is the cumulative tax on all lower brackets
 *      (Pub 15-T column C). When baseAmountCents is not supplied it is derived
 *      by summing the lower brackets.
 *   4. Divide by payPeriodsPerYear to get the per-period withholding and add
 *      any flat additional withholding the employee elected.
 */

/** One marginal tax bracket. Mirrors the persisted taxBracket row shape. */
export interface MarginalBracket {
  /** Annual bracket floor in cents (inclusive). */
  minIncome: number;
  /** Annual bracket ceiling in cents (exclusive). null = no upper limit. */
  maxIncome?: number | null;
  /** Marginal rate in basis points (e.g. 2200 = 22%). */
  rate: number;
  /**
   * Cumulative tax on all income below minIncome, in cents (Pub 15-T col C).
   * When null/undefined the engine derives it from the lower brackets so a
   * schedule that only lists floor + rate still computes correctly.
   */
  baseAmountCents?: number | null;
}

export interface ComputePeriodWithholdingInput {
  /**
   * Annualized taxable wage in cents BEFORE the standard deduction and
   * allowances are removed (typically periodWage × payPeriodsPerYear).
   */
  annualTaxableWage: number;
  /** Marginal brackets for the employee's jurisdiction / filing status / year. */
  brackets: MarginalBracket[];
  /** Filing status — accepted for symmetry/logging; bracket selection is the caller's job. */
  filingStatus?: string | null;
  /** Number of pay periods in a year (e.g. 12 monthly, 26 biweekly, 52 weekly). */
  payPeriodsPerYear: number;
  /** Number of withholding allowances claimed. */
  allowances?: number;
  /** Annual value of one allowance, in cents. */
  allowanceValueCents?: number;
  /** Annual standard deduction, in cents. */
  standardDeductionCents?: number;
  /** Flat extra amount the employee elected to withhold each period, in cents. */
  additionalWithholding?: number;
}

export interface PeriodWithholdingResult {
  /** Withholding for THIS pay period, in cents (includes additionalWithholding). */
  periodWithholding: number;
  /** Tentative tax for the whole year, in cents (before dividing by periods). */
  annualTax: number;
  /** Annual wage after standard deduction + allowances, in cents (never negative). */
  taxableAfterDeductions: number;
}

/**
 * Sort brackets by floor and back-fill each bracket's cumulative base
 * (Pub 15-T col C) when the caller did not supply it, so callers can pass a
 * bare floor+rate schedule.
 */
interface NormalizedBracket {
  minIncome: number;
  maxIncome: number | null;
  rate: number;
  baseAmountCents: number;
}

function normalizeBrackets(brackets: MarginalBracket[]): NormalizedBracket[] {
  const sorted = [...brackets]
    .filter((b) => Number.isFinite(b.minIncome) && b.rate >= 0)
    .sort((a, b) => a.minIncome - b.minIncome);

  const out: NormalizedBracket[] = [];

  let derivedBase = 0;
  let prevFloor = 0;
  let prevRate = 0;
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (i > 0) {
      // Tax accrued across the previous bracket band up to this floor.
      derivedBase += Math.round(((b.minIncome - prevFloor) * prevRate) / 10000);
    }
    out.push({
      minIncome: b.minIncome,
      maxIncome: b.maxIncome ?? null,
      rate: b.rate,
      baseAmountCents: b.baseAmountCents ?? derivedBase,
    });
    prevFloor = b.minIncome;
    prevRate = b.rate;
  }
  return out;
}

/**
 * Compute the per-period income-tax withholding using marginal brackets.
 * Returns zeros (not negatives) when there is no taxable wage or no brackets.
 */
export function computePeriodWithholding(
  input: ComputePeriodWithholdingInput
): PeriodWithholdingResult {
  const periods =
    input.payPeriodsPerYear > 0 ? input.payPeriodsPerYear : 1; // guard /0
  const allowances = Math.max(0, input.allowances ?? 0);
  const allowanceValue = Math.max(0, input.allowanceValueCents ?? 0);
  const stdDeduction = Math.max(0, input.standardDeductionCents ?? 0);
  const additional = Math.max(0, input.additionalWithholding ?? 0);

  const annualWage = Math.max(0, input.annualTaxableWage);
  const taxableAfterDeductions = Math.max(
    0,
    annualWage - stdDeduction - allowances * allowanceValue
  );

  const brackets = normalizeBrackets(input.brackets);
  if (brackets.length === 0 || taxableAfterDeductions === 0) {
    return {
      periodWithholding: additional,
      annualTax: 0,
      taxableAfterDeductions,
    };
  }

  // Find the highest bracket whose floor the wage reaches.
  let chosen = brackets[0];
  for (const b of brackets) {
    if (taxableAfterDeductions >= b.minIncome) chosen = b;
    else break;
  }

  const annualTax = Math.max(
    0,
    chosen.baseAmountCents +
      Math.round(((taxableAfterDeductions - chosen.minIncome) * chosen.rate) / 10000)
  );

  const periodWithholding = Math.round(annualTax / periods) + additional;

  return { periodWithholding, annualTax, taxableAfterDeductions };
}

/**
 * Cap a period wage against a wage base that is depleted year-to-date, and
 * tax whatever slice of the period wage still falls below it. Shared by
 * computeFica (employee SS), computeEmployerTaxes (SS/FUTA/SUTA), and
 * computeCnss (Morocco's monthly-capped contributions, called with ytdWage
 * pinned to 0 since that cap resets every period rather than accumulating
 * across the year).
 */
export function cappedWageSlice(
  periodWage: number,
  ytdWage: number,
  wageBaseCents: number,
  rateBp: number
): number {
  const base = Math.max(0, wageBaseCents);
  const room = Math.max(0, base - Math.max(0, ytdWage));
  const taxable = Math.min(Math.max(0, periodWage), room);
  return Math.round((taxable * Math.max(0, rateBp)) / 10000);
}

export interface ComputeFicaInput {
  /** Taxable wage for THIS period, in cents. */
  periodWage: number;
  /** Year-to-date wage BEFORE this period, in cents. */
  ytdWage: number;
  /** Annual Social Security wage base cap, in cents. */
  ssWageBaseCents: number;
  /** Social Security rate in basis points (e.g. 620 = 6.2%). */
  ssRateBp: number;
  /** Medicare rate in basis points (e.g. 145 = 1.45%). */
  medicareRateBp: number;
  /** YTD wage threshold over which Additional Medicare applies, in cents. */
  addlMedicareThresholdCents: number;
  /** Additional Medicare rate in basis points (e.g. 90 = 0.9%). */
  addlMedicareRateBp: number;
}

export interface FicaResult {
  /** Employee Social Security withheld this period, in cents (capped at wage base). */
  socialSecurity: number;
  /** Employee Medicare withheld this period, in cents (uncapped). */
  medicare: number;
  /** Additional Medicare (0.9%) on YTD wages over the threshold, in cents. */
  additionalMedicare: number;
  /** Sum of all three, in cents. */
  total: number;
}

/**
 * Compute the employee-side FICA withholding for one pay period.
 *   • Social Security: ssRateBp on wages up to the annual wage base. Once YTD
 *     wages reach the base, no further SS is withheld; a period that straddles
 *     the base is taxed only on the portion below it.
 *   • Medicare: medicareRateBp on the full period wage (no cap).
 *   • Additional Medicare: addlMedicareRateBp on the portion of YTD wages above
 *     the threshold that falls in THIS period.
 */
export function computeFica(input: ComputeFicaInput): FicaResult {
  const periodWage = Math.max(0, input.periodWage);
  const ytdWage = Math.max(0, input.ytdWage);

  // Social Security: only the slice of this period's wage that is still below
  // the annual wage base is taxed.
  const socialSecurity = cappedWageSlice(periodWage, ytdWage, input.ssWageBaseCents, input.ssRateBp);

  // Medicare: uncapped on the full period wage.
  const medicare = Math.round((periodWage * Math.max(0, input.medicareRateBp)) / 10000);

  // Additional Medicare: the part of THIS period's wage that pushes cumulative
  // wages above the threshold.
  const threshold = Math.max(0, input.addlMedicareThresholdCents);
  const newYtd = ytdWage + periodWage;
  const addlTaxable = Math.max(0, newYtd - Math.max(ytdWage, threshold));
  const additionalMedicare = Math.round(
    (addlTaxable * Math.max(0, input.addlMedicareRateBp)) / 10000
  );

  const total = socialSecurity + medicare + additionalMedicare;
  return { socialSecurity, medicare, additionalMedicare, total };
}

export interface ComputeEmployerTaxesInput {
  /** Taxable wage for THIS period, in cents. */
  periodWage: number;
  /** Year-to-date wage BEFORE this period, in cents. */
  ytdWage: number;
  /** When true, employer matches employee Social Security + Medicare. */
  employerFicaEnabled: boolean;
  /** Annual Social Security wage base cap, in cents. */
  ssWageBaseCents: number;
  /** Employer Social Security rate in basis points (typically 620 = 6.2%). */
  ssRateBp: number;
  /** Employer Medicare rate in basis points (typically 145 = 1.45%, no employer Additional Medicare). */
  medicareRateBp: number;
  /** FUTA rate in basis points (e.g. 60 = 0.6%). */
  futaRateBp: number;
  /** Annual FUTA wage base cap, in cents (e.g. 700000 = $7,000). */
  futaWageBaseCents: number;
  /** SUTA rate in basis points. */
  sutaRateBp: number;
  /** Annual SUTA wage base cap, in cents. */
  sutaWageBaseCents: number;
}

export interface EmployerTaxResult {
  /** Employer Social Security match this period, in cents (capped at wage base). */
  socialSecurity: number;
  /** Employer Medicare match this period, in cents (uncapped, no additional medicare). */
  medicare: number;
  /** FUTA this period, in cents (capped at FUTA wage base). */
  futa: number;
  /** SUTA this period, in cents (capped at SUTA wage base). */
  suta: number;
  /** Sum of all employer taxes, in cents. */
  total: number;
}

/**
 * Compute the EMPLOYER-side payroll taxes for one pay period. These are an
 * expense to the company on top of gross wages (they do NOT reduce employee net
 * pay):
 *   • Employer FICA (when enabled): matches employee SS (capped at the wage
 *     base) and Medicare (uncapped). There is no employer Additional Medicare.
 *   • FUTA / SUTA: unemployment taxes on the slice of this period's wage still
 *     below the respective annual wage base.
 * Every component taxes only the portion of the period wage that remains below
 * its cap given YTD wages, mirroring computeFica's straddle handling.
 */
export function computeEmployerTaxes(
  input: ComputeEmployerTaxesInput
): EmployerTaxResult {
  const periodWage = Math.max(0, input.periodWage);
  const ytdWage = Math.max(0, input.ytdWage);

  let socialSecurity = 0;
  let medicare = 0;
  if (input.employerFicaEnabled) {
    socialSecurity = cappedWageSlice(periodWage, ytdWage, input.ssWageBaseCents, input.ssRateBp);
    // Medicare is uncapped.
    medicare = Math.round((periodWage * Math.max(0, input.medicareRateBp)) / 10000);
  }

  const futa = cappedWageSlice(periodWage, ytdWage, input.futaWageBaseCents, input.futaRateBp);
  const suta = cappedWageSlice(periodWage, ytdWage, input.sutaWageBaseCents, input.sutaRateBp);

  const total = socialSecurity + medicare + futa + suta;
  return { socialSecurity, medicare, futa, suta, total };
}

/** Map a payFrequency enum value to the number of pay periods per year. */
export function payPeriodsPerYear(payFrequency: string): number {
  switch (payFrequency) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "monthly":
    default:
      return 12;
  }
}

// ─── Morocco: CNSS / AMO / IR ────────────────────────────────────────

export interface ComputeCnssInput {
  /** Taxable wage for THIS period, in cents. */
  periodWage: number;
  /** Monthly wage ceiling for the capped components (pension/CT/IPE), in cents. */
  monthlyCeilingCents: number;
  pensionEmployeeRateBp: number;
  ctEmployeeRateBp: number;
  ipeEmployeeRateBp: number;
  /** Employer-only, uncapped. */
  allocationsFamilialesRateBp: number;
  pensionEmployerRateBp: number;
  ctEmployerRateBp: number;
  ipeEmployerRateBp: number;
  /** Employer-only, uncapped (taxe de formation professionnelle). */
  tfpRateBp: number;
}

export interface CnssResult {
  employee: { pension: number; ct: number; ipe: number; total: number };
  employer: {
    allocationsFamiliales: number;
    pension: number;
    ct: number;
    ipe: number;
    tfp: number;
    total: number;
  };
}

/**
 * Compute Moroccan CNSS contributions for one pay period. Pension/CT/IPE are
 * capped at a MONTHLY wage ceiling (not an annual YTD-depleted base like US
 * FICA) — ytdWage is pinned to 0 in every cappedWageSlice call so the ceiling
 * resets each period. Correct for monthly-paid employees; non-monthly pay
 * frequencies would need the ceiling prorated per period, which is out of
 * scope here. Allocations familiales and TFP are employer-only and uncapped.
 */
export function computeCnss(input: ComputeCnssInput): CnssResult {
  const periodWage = Math.max(0, input.periodWage);
  const capped = (rateBp: number) =>
    cappedWageSlice(periodWage, 0, input.monthlyCeilingCents, rateBp);
  const uncapped = (rateBp: number) =>
    Math.round((periodWage * Math.max(0, rateBp)) / 10000);

  const employeePension = capped(input.pensionEmployeeRateBp);
  const employeeCt = capped(input.ctEmployeeRateBp);
  const employeeIpe = capped(input.ipeEmployeeRateBp);

  const employerAllocationsFamiliales = uncapped(input.allocationsFamilialesRateBp);
  const employerPension = capped(input.pensionEmployerRateBp);
  const employerCt = capped(input.ctEmployerRateBp);
  const employerIpe = capped(input.ipeEmployerRateBp);
  const employerTfp = uncapped(input.tfpRateBp);

  return {
    employee: {
      pension: employeePension,
      ct: employeeCt,
      ipe: employeeIpe,
      total: employeePension + employeeCt + employeeIpe,
    },
    employer: {
      allocationsFamiliales: employerAllocationsFamiliales,
      pension: employerPension,
      ct: employerCt,
      ipe: employerIpe,
      tfp: employerTfp,
      total:
        employerAllocationsFamiliales +
        employerPension +
        employerCt +
        employerIpe +
        employerTfp,
    },
  };
}

export interface ComputeAmoInput {
  /** Taxable wage for THIS period, in cents. */
  periodWage: number;
  employeeRateBp: number;
  employerRateBp: number;
}

export interface AmoResult {
  employee: number;
  employer: number;
}

/** Compute Moroccan AMO (mandatory health insurance) — uncapped, both sides. */
export function computeAmo(input: ComputeAmoInput): AmoResult {
  const periodWage = Math.max(0, input.periodWage);
  return {
    employee: Math.round((periodWage * Math.max(0, input.employeeRateBp)) / 10000),
    employer: Math.round((periodWage * Math.max(0, input.employerRateBp)) / 10000),
  };
}

/** Annual value of one Moroccan IR per-dependent deduction, in cents (600 MAD). */
export const MA_DEPENDENT_ALLOWANCE_VALUE_CENTS = 60000;

const MA_PROFESSIONAL_EXPENSE_THRESHOLD_CENTS = 7_800_000; // 78,000 MAD/year
const MA_PROFESSIONAL_EXPENSE_CAP_CENTS = 3_500_000; // 35,000 MAD/year
const MA_PROFESSIONAL_EXPENSE_RATE_LOW_BP = 3500; // 35%
const MA_PROFESSIONAL_EXPENSE_RATE_HIGH_BP = 2500; // 25%

/**
 * Moroccan IR's standard professional-expense deduction (CGI Article 59-I-A,
 * set by Loi de Finances 2023 / Law 50-22 — not LF2026, despite this feature
 * shipping alongside 2026 rates): a THRESHOLD rule, not a marginal one. The
 * rate (35% or 25%) applies to the ENTIRE annual gross depending on which
 * side of 78,000 MAD/year it falls on — not 35% of the first 78,000 plus 25%
 * of the rest. Result is capped at 35,000 MAD/year.
 * Feed the result into computePeriodWithholding's standardDeductionCents —
 * that engine only accepts a flat cents amount, not a percentage rule.
 */
export function computeMoroccanProfessionalExpenseDeduction(
  annualGrossCents: number
): number {
  const gross = Math.max(0, annualGrossCents);
  const rateBp =
    gross <= MA_PROFESSIONAL_EXPENSE_THRESHOLD_CENTS
      ? MA_PROFESSIONAL_EXPENSE_RATE_LOW_BP
      : MA_PROFESSIONAL_EXPENSE_RATE_HIGH_BP;
  const deduction = Math.round((gross * rateBp) / 10000);
  return Math.min(deduction, MA_PROFESSIONAL_EXPENSE_CAP_CENTS);
}
