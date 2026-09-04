import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeCnss,
  computeAmo,
  computeMoroccanProfessionalExpenseDeduction,
  computePeriodWithholding,
} from "../lib/api/payroll-tax";
import { MA_IR_BRACKETS_2026 } from "../lib/db/seed-ma-payroll";

// 10,000 MAD/month gross, in cents.
const GROSS_10000_MAD = 1_000_000;

const CNSS_RATES = {
  monthlyCeilingCents: 600_000, // 6,000 MAD
  pensionEmployeeRateBp: 396,
  ctEmployeeRateBp: 33,
  ipeEmployeeRateBp: 19,
  allocationsFamilialesRateBp: 640,
  pensionEmployerRateBp: 793,
  ctEmployerRateBp: 67,
  ipeEmployerRateBp: 38,
  tfpRateBp: 160,
};

test("computeCnss caps pension/CT/IPE at the 6,000 MAD monthly ceiling but not allocations familiales/TFP", () => {
  const result = computeCnss({ periodWage: GROSS_10000_MAD, ...CNSS_RATES });

  // Capped components: rate applied to 600,000 cents (the ceiling), not the full 1,000,000 gross.
  assert.equal(result.employee.pension, 23_760); // 600,000 * 3.96%
  assert.equal(result.employee.ct, 1_980); // 600,000 * 0.33%
  assert.equal(result.employee.ipe, 1_140); // 600,000 * 0.19%
  assert.equal(result.employee.total, 26_880);

  assert.equal(result.employer.pension, 47_580); // 600,000 * 7.93%
  assert.equal(result.employer.ct, 4_020); // 600,000 * 0.67%
  assert.equal(result.employer.ipe, 2_280); // 600,000 * 0.38%

  // Uncapped components: rate applied to the full gross (1,000,000), not the ceiling.
  assert.equal(result.employer.allocationsFamiliales, 64_000); // 1,000,000 * 6.40%
  assert.equal(result.employer.tfp, 16_000); // 1,000,000 * 1.60%
  assert.equal(result.employer.total, 47_580 + 4_020 + 2_280 + 64_000 + 16_000);
});

test("computeCnss leaves the capped components untouched below the ceiling", () => {
  const belowCeiling = 500_000; // 5,000 MAD, under the 6,000 MAD ceiling
  const result = computeCnss({ periodWage: belowCeiling, ...CNSS_RATES });
  assert.equal(result.employee.pension, Math.round((belowCeiling * 396) / 10000));
  assert.equal(result.employer.allocationsFamiliales, Math.round((belowCeiling * 640) / 10000));
});

test("computeAmo applies both rates to the full gross, uncapped", () => {
  const result = computeAmo({
    periodWage: GROSS_10000_MAD,
    employeeRateBp: 226,
    employerRateBp: 411,
  });
  assert.equal(result.employee, 22_600); // 1,000,000 * 2.26%
  assert.equal(result.employer, 41_100); // 1,000,000 * 4.11%
});

test("computeMoroccanProfessionalExpenseDeduction is a threshold rule (CGI Art. 59-I-A), not a marginal one", () => {
  // At/below the 78,000 MAD threshold: 35% applies to the ENTIRE gross.
  assert.equal(computeMoroccanProfessionalExpenseDeduction(5_000_000), Math.round(5_000_000 * 0.35));

  // Above 78,000 MAD: 25% applies to the ENTIRE gross (not 35% of the first
  // 78,000 plus 25% of the rest) — 100,000 MAD/year -> 25,000 MAD deduction,
  // per the worked example in docs/research/morocco-payroll-rate-verification.md §8.
  assert.equal(computeMoroccanProfessionalExpenseDeduction(10_000_000), 2_500_000);

  // 150,000 MAD/year -> 25% x 150,000 = 37,500 MAD, capped at 35,000 MAD.
  assert.equal(computeMoroccanProfessionalExpenseDeduction(15_000_000), 3_500_000);
});

test("Moroccan IR withholding spans multiple brackets for a 120,000 MAD/year salary", () => {
  // Uses the real seeded 2026 schedule (lib/db/seed-ma-payroll.ts), not a
  // hand-copied one, so this test actually exercises what gets persisted.
  const annualGrossCents = 12_000_000; // 120,000 MAD/year, i.e. 10,000 MAD/month
  const professionalExpenseDeduction = computeMoroccanProfessionalExpenseDeduction(annualGrossCents);
  // Above the 78,000 MAD threshold: 25% of the entire 120,000 MAD gross = 30,000 MAD (not capped).
  assert.equal(professionalExpenseDeduction, 3_000_000);

  const result = computePeriodWithholding({
    annualTaxableWage: annualGrossCents,
    brackets: MA_IR_BRACKETS_2026,
    payPeriodsPerYear: 12,
    standardDeductionCents: professionalExpenseDeduction,
    allowances: 0,
    allowanceValueCents: 60_000,
  });

  // Taxable base: 12,000,000 - 3,000,000 = 9,000,000 (90,000 MAD) — falls in the 80k-100k bracket.
  assert.equal(result.taxableAfterDeductions, 9_000_000);

  // Hand-computed: (60k-40k)*10% + (80k-60k)*20% + (90k-80k)*30% = 2,000 + 4,000 + 3,000 = 9,000 MAD.
  assert.equal(result.annualTax, 900_000);
  assert.equal(result.periodWithholding, 75_000); // 900,000 / 12 months
});

test("Moroccan IR withholding is zero below the 40,000 MAD/year threshold", () => {
  const annualGrossCents = 3_000_000; // 30,000 MAD/year
  const result = computePeriodWithholding({
    annualTaxableWage: annualGrossCents,
    brackets: MA_IR_BRACKETS_2026,
    payPeriodsPerYear: 12,
    standardDeductionCents: computeMoroccanProfessionalExpenseDeduction(annualGrossCents),
    allowances: 0,
    allowanceValueCents: 60_000,
  });
  assert.equal(result.annualTax, 0);
  assert.equal(result.periodWithholding, 0);
});
