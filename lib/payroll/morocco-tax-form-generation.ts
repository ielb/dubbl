import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organization,
  payrollEmployee,
  payrollItem,
  payrollItemEmployerTax,
  payrollItemTaxBreakdown,
  payrollRun,
  taxForm,
} from "@/lib/db/schema";
import {
  aggregateMoroccanContributions,
  type MoroccanTaxFormType,
} from "@/lib/payroll/morocco-tax-forms";

type DbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

interface GenerateMoroccanTaxFormsInput {
  organizationId: string;
  generationId: string;
  taxYear: number;
  taxMonth?: number;
  formType: MoroccanTaxFormType;
  exec?: DbOrTx;
}

const FILING_DISCLAIMER =
  "Generated documents are a starting point for filing preparation and do not guarantee regulatory compliance. Verify all figures before submitting them to CNSS or the DGI.";

function monthRange(taxYear: number, taxMonth: number) {
  const start = new Date(Date.UTC(taxYear, taxMonth - 1, 1));
  const endExclusive = new Date(Date.UTC(taxYear, taxMonth, 1));
  const displayEnd = new Date(endExclusive.getTime() - 86_400_000);
  return {
    start: start.toISOString().slice(0, 10),
    endExclusive: endExclusive.toISOString().slice(0, 10),
    displayEnd: displayEnd.toISOString().slice(0, 10),
  };
}

/** Generate stored Moroccan filing records from completed payroll runs. */
export async function generateMoroccanTaxForms({
  organizationId,
  generationId,
  taxYear,
  taxMonth,
  formType,
  exec = db,
}: GenerateMoroccanTaxFormsInput): Promise<(typeof taxForm.$inferSelect)[]> {
  if (formType === "ma_cnss_declaration" && taxMonth == null) {
    throw new Error("taxMonth is required for a Moroccan CNSS declaration");
  }

  const period =
    formType === "ma_cnss_declaration"
      ? monthRange(taxYear, taxMonth as number)
      : {
          start: `${taxYear}-01-01`,
          endExclusive: `${taxYear + 1}-01-01`,
          displayEnd: `${taxYear}-12-31`,
        };

  const employeeTotals = await exec
    .select({
      employeeId: payrollItem.employeeId,
      totalGross: sql<number>`COALESCE(SUM(${payrollItem.grossAmount}), 0)`.mapWith(Number),
      totalPreTax: sql<number>`COALESCE(SUM(${payrollItem.preTaxDeductions}), 0)`.mapWith(Number),
    })
    .from(payrollItem)
    .innerJoin(payrollRun, eq(payrollItem.payrollRunId, payrollRun.id))
    .where(
      and(
        eq(payrollRun.organizationId, organizationId),
        eq(payrollRun.status, "completed"),
        gte(payrollRun.payPeriodEnd, period.start),
        lt(payrollRun.payPeriodEnd, period.endExclusive)
      )
    )
    .groupBy(payrollItem.employeeId);

  if (employeeTotals.length === 0) return [];

  const employeeTaxRows = await exec
    .select({
      employeeId: payrollItem.employeeId,
      taxKind: payrollItemTaxBreakdown.taxKind,
      amount: sql<number>`COALESCE(SUM(${payrollItemTaxBreakdown.amount}), 0)`.mapWith(Number),
    })
    .from(payrollItemTaxBreakdown)
    .innerJoin(payrollItem, eq(payrollItemTaxBreakdown.payrollItemId, payrollItem.id))
    .innerJoin(payrollRun, eq(payrollItem.payrollRunId, payrollRun.id))
    .where(
      and(
        eq(payrollRun.organizationId, organizationId),
        eq(payrollRun.status, "completed"),
        gte(payrollRun.payPeriodEnd, period.start),
        lt(payrollRun.payPeriodEnd, period.endExclusive)
      )
    )
    .groupBy(payrollItem.employeeId, payrollItemTaxBreakdown.taxKind);

  const employerTaxRows = await exec
    .select({
      employeeId: payrollItem.employeeId,
      taxKind: payrollItemEmployerTax.taxKind,
      amount: sql<number>`COALESCE(SUM(${payrollItemEmployerTax.amount}), 0)`.mapWith(Number),
    })
    .from(payrollItemEmployerTax)
    .innerJoin(payrollItem, eq(payrollItemEmployerTax.payrollItemId, payrollItem.id))
    .innerJoin(payrollRun, eq(payrollItem.payrollRunId, payrollRun.id))
    .where(
      and(
        eq(payrollRun.organizationId, organizationId),
        eq(payrollRun.status, "completed"),
        gte(payrollRun.payPeriodEnd, period.start),
        lt(payrollRun.payPeriodEnd, period.endExclusive)
      )
    )
    .groupBy(payrollItem.employeeId, payrollItemEmployerTax.taxKind);

  const employeeIds = employeeTotals.map((row) => row.employeeId);
  const employees = await exec.query.payrollEmployee.findMany({
    where: and(
      eq(payrollEmployee.organizationId, organizationId),
      inArray(payrollEmployee.id, employeeIds)
    ),
  });
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  const employeeTaxById = new Map<string, typeof employeeTaxRows>();
  for (const row of employeeTaxRows) {
    const rows = employeeTaxById.get(row.employeeId) ?? [];
    rows.push(row);
    employeeTaxById.set(row.employeeId, rows);
  }
  const employerTaxById = new Map<string, typeof employerTaxRows>();
  for (const row of employerTaxRows) {
    const rows = employerTaxById.get(row.employeeId) ?? [];
    rows.push(row);
    employerTaxById.set(row.employeeId, rows);
  }

  const employeeLines = employeeTotals.flatMap((wages) => {
    const employee = employeeById.get(wages.employeeId);
    if (!employee) return [];
    const contributions = aggregateMoroccanContributions(
      employeeTaxById.get(employee.id) ?? [],
      employerTaxById.get(employee.id) ?? []
    );
    return [
      {
        employee,
        wages,
        contributions,
      },
    ];
  });

  if (formType === "ma_ir_annual_summary") {
    const forms: (typeof taxForm.$inferSelect)[] = [];
    for (const line of employeeLines) {
      const [form] = await exec
        .insert(taxForm)
        .values({
          generationId,
          recipientType: "employee",
          recipientId: line.employee.id,
          recipientName: line.employee.name,
          recipientTaxId: null,
          formType,
          taxYear,
          formData: {
            currency: "MAD",
            annual_gross_wages: line.wages.totalGross,
            annual_taxable_wages: Math.max(
              0,
              line.wages.totalGross - line.wages.totalPreTax
            ),
            ir_withheld: line.contributions.irWithheld,
            employee_social_contributions: line.contributions.employee,
            employer_social_contributions: line.contributions.employer,
            employee_email: line.employee.email,
            employee_number: line.employee.employeeNumber,
            disclaimer: FILING_DISCLAIMER,
          },
          status: "generated",
        })
        .returning();
      forms.push(form);
    }
    return forms;
  }

  const org = await exec.query.organization.findFirst({
    where: eq(organization.id, organizationId),
  });
  if (!org) return [];

  const declarationTotals = aggregateMoroccanContributions(
    employeeTaxRows,
    employerTaxRows
  );
  const [form] = await exec
    .insert(taxForm)
    .values({
      generationId,
      recipientType: "organization",
      recipientId: org.id,
      recipientName: org.name,
      recipientTaxId: org.taxId,
      formType,
      taxYear,
      formData: {
        currency: "MAD",
        period_start: period.start,
        period_end: period.displayEnd,
        employee_count: employeeLines.length,
        total_gross_wages: employeeLines.reduce(
          (sum, line) => sum + line.wages.totalGross,
          0
        ),
        employee_contributions: declarationTotals.employee,
        employer_contributions: declarationTotals.employer,
        total_social_contributions: declarationTotals.totalSocialContributions,
        employees: employeeLines.map((line) => ({
          employee_id: line.employee.id,
          employee_number: line.employee.employeeNumber,
          employee_name: line.employee.name,
          gross_wages: line.wages.totalGross,
          employee_contributions: line.contributions.employee,
          employer_contributions: line.contributions.employer,
          total_social_contributions: line.contributions.totalSocialContributions,
        })),
        disclaimer: FILING_DISCLAIMER,
      },
      status: "generated",
    })
    .returning();

  return [form];
}
