export interface TaxBreakdownAmount {
  taxKind: string;
  amount: number;
}

export interface MoroccanContributionSummary {
  irWithheld: number;
  employee: {
    pension: number;
    shortTermSocialBenefits: number;
    lossOfEmploymentIndemnity: number;
    mandatoryHealthInsurance: number;
    total: number;
  };
  employer: {
    pension: number;
    shortTermSocialBenefits: number;
    lossOfEmploymentIndemnity: number;
    familyAllowances: number;
    mandatoryHealthInsurance: number;
    vocationalTrainingTax: number;
    total: number;
  };
  totalSocialContributions: number;
}

/**
 * Aggregate the Moroccan payroll tax kinds persisted for completed payroll
 * items into the line items used by CNSS declarations and annual IR summaries.
 * Unknown kinds are intentionally ignored so US-only rows can never leak into
 * a Moroccan filing document.
 */
export function aggregateMoroccanContributions(
  employeeRows: readonly TaxBreakdownAmount[],
  employerRows: readonly TaxBreakdownAmount[]
): MoroccanContributionSummary {
  const employee = {
    pension: 0,
    shortTermSocialBenefits: 0,
    lossOfEmploymentIndemnity: 0,
    mandatoryHealthInsurance: 0,
    total: 0,
  };
  const employer = {
    pension: 0,
    shortTermSocialBenefits: 0,
    lossOfEmploymentIndemnity: 0,
    familyAllowances: 0,
    mandatoryHealthInsurance: 0,
    vocationalTrainingTax: 0,
    total: 0,
  };
  let irWithheld = 0;

  for (const row of employeeRows) {
    switch (row.taxKind) {
      case "income_tax":
        irWithheld += row.amount;
        break;
      case "cnss_pension":
        employee.pension += row.amount;
        break;
      case "cnss_ct":
        employee.shortTermSocialBenefits += row.amount;
        break;
      case "cnss_ipe":
        employee.lossOfEmploymentIndemnity += row.amount;
        break;
      case "amo":
        employee.mandatoryHealthInsurance += row.amount;
        break;
    }
  }

  for (const row of employerRows) {
    switch (row.taxKind) {
      case "employer_cnss_pension":
        employer.pension += row.amount;
        break;
      case "employer_cnss_ct":
        employer.shortTermSocialBenefits += row.amount;
        break;
      case "employer_cnss_ipe":
        employer.lossOfEmploymentIndemnity += row.amount;
        break;
      case "employer_cnss_allocations_familiales":
        employer.familyAllowances += row.amount;
        break;
      case "employer_amo":
        employer.mandatoryHealthInsurance += row.amount;
        break;
      case "employer_tfp":
        employer.vocationalTrainingTax += row.amount;
        break;
    }
  }

  employee.total =
    employee.pension +
    employee.shortTermSocialBenefits +
    employee.lossOfEmploymentIndemnity +
    employee.mandatoryHealthInsurance;
  employer.total =
    employer.pension +
    employer.shortTermSocialBenefits +
    employer.lossOfEmploymentIndemnity +
    employer.familyAllowances +
    employer.mandatoryHealthInsurance +
    employer.vocationalTrainingTax;

  return {
    irWithheld,
    employee,
    employer,
    totalSocialContributions: employee.total + employer.total,
  };
}
