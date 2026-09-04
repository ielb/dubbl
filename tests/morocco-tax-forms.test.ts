import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateMoroccanContributions } from "../lib/payroll/morocco-tax-forms";

test("aggregateMoroccanContributions reconciles employee and employer declaration lines", () => {
  const summary = aggregateMoroccanContributions(
    [
      { taxKind: "income_tax", amount: 62_500 },
      { taxKind: "cnss_pension", amount: 20_000 },
      { taxKind: "cnss_pension", amount: 3_760 },
      { taxKind: "cnss_ct", amount: 1_980 },
      { taxKind: "cnss_ipe", amount: 1_140 },
      { taxKind: "amo", amount: 22_600 },
      { taxKind: "medicare", amount: 99_999 },
    ],
    [
      { taxKind: "employer_cnss_pension", amount: 47_580 },
      { taxKind: "employer_cnss_ct", amount: 4_020 },
      { taxKind: "employer_cnss_ipe", amount: 2_280 },
      { taxKind: "employer_cnss_allocations_familiales", amount: 64_000 },
      { taxKind: "employer_amo", amount: 41_100 },
      { taxKind: "employer_tfp", amount: 16_000 },
      { taxKind: "employer_social_security", amount: 99_999 },
    ]
  );

  assert.deepEqual(summary, {
    irWithheld: 62_500,
    employee: {
      pension: 23_760,
      shortTermSocialBenefits: 1_980,
      lossOfEmploymentIndemnity: 1_140,
      mandatoryHealthInsurance: 22_600,
      total: 49_480,
    },
    employer: {
      pension: 47_580,
      shortTermSocialBenefits: 4_020,
      lossOfEmploymentIndemnity: 2_280,
      familyAllowances: 64_000,
      mandatoryHealthInsurance: 41_100,
      vocationalTrainingTax: 16_000,
      total: 174_980,
    },
    totalSocialContributions: 224_460,
  });
});
