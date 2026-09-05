"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { isMoroccanTaxFormType } from "@/lib/payroll/morocco-tax-forms";

type TaxFormType =
  | "1099_nec"
  | "1099_misc"
  | "w2"
  | "ma_cnss_declaration"
  | "ma_ir_annual_summary";

interface TaxFormDetail {
  id: string;
  recipientName: string;
  recipientTaxId: string | null;
  recipientType: string;
  formType: TaxFormType;
  taxYear: number;
  formData: Record<string, unknown>;
  status: string;
}

interface ContributionData {
  pension?: number;
  shortTermSocialBenefits?: number;
  lossOfEmploymentIndemnity?: number;
  familyAllowances?: number;
  mandatoryHealthInsurance?: number;
  vocationalTrainingTax?: number;
  total?: number;
}

interface CnssEmployeeLine {
  employee_id: string;
  employee_number?: string | null;
  employee_name: string;
  gross_wages: number;
  employee_contributions: ContributionData;
  employer_contributions: ContributionData;
  total_social_contributions: number;
}

const w2Labels: Record<string, string> = {
  box1_wages: "Box 1 - Wages, tips, other compensation",
  box2_federal_tax: "Box 2 - Federal income tax withheld",
  box3_ss_wages: "Box 3 - Social security wages",
  box4_ss_tax: "Box 4 - Social security tax withheld",
  box5_medicare_wages: "Box 5 - Medicare wages and tips",
  box6_medicare_tax: "Box 6 - Medicare tax withheld",
};

export default function TaxFormDetailPage() {
  const t = useTranslations("Payroll");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<TaxFormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(t("taxForms.detailDocumentTitle"));

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId") || ""
      : "";

  const loadForm = useCallback(() => {
    if (!orgId) return;
    fetch(`/api/v1/payroll/tax-forms/${id}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.id) setForm(data);
      })
      .finally(() => setLoading(false));
  }, [id, orgId]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  function formTypeLabel(formType: TaxFormType) {
    return t(`taxForms.formTypes.${formType}`);
  }

  function statusBadge(status: string) {
    const label =
      status === "draft" ||
      status === "generated" ||
      status === "sent" ||
      status === "filed" ||
      status === "corrected"
        ? t(`taxForms.status.${status}`)
        : status;
    if (status === "draft") return <Badge variant="secondary">{label}</Badge>;
    if (status === "sent") return <Badge variant="outline">{label}</Badge>;
    if (status === "filed") {
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">{label}</Badge>;
    }
    return <Badge>{label}</Badge>;
  }

  function formatMoney(cents: number) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: form && isMoroccanTaxFormType(form.formType) ? "MAD" : "USD",
    }).format(cents / 100);
  }

  function moneyRow(label: string, amount: unknown) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-right font-mono text-sm font-bold tabular-nums">
          {typeof amount === "number" ? formatMoney(amount) : "-"}
        </span>
      </div>
    );
  }

  function contributionRows(data: ContributionData | undefined) {
    if (!data) return null;
    const rows = [
      [t("taxForms.contributions.pension"), data.pension],
      [
        t("taxForms.contributions.shortTermSocialBenefits"),
        data.shortTermSocialBenefits,
      ],
      [
        t("taxForms.contributions.lossOfEmploymentIndemnity"),
        data.lossOfEmploymentIndemnity,
      ],
      [t("taxForms.contributions.familyAllowances"), data.familyAllowances],
      [
        t("taxForms.contributions.mandatoryHealthInsurance"),
        data.mandatoryHealthInsurance,
      ],
      [
        t("taxForms.contributions.vocationalTrainingTax"),
        data.vocationalTrainingTax,
      ],
      [t("taxForms.contributions.total"), data.total],
    ] as const;

    return rows
      .filter(([, amount]) => typeof amount === "number")
      .map(([label, amount]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-4 border-t px-4 py-2.5 first:border-t-0"
        >
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="font-mono text-sm font-medium tabular-nums">
            {formatMoney(amount as number)}
          </span>
        </div>
      ));
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("taxForms.loading")}</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("taxForms.notFound")}</p>
        <Button variant="ghost" size="sm" asChild className="mt-2">
          <Link href="/payroll/tax-forms">{t("taxForms.back")}</Link>
        </Button>
      </div>
    );
  }

  const data = form.formData;
  const isMoroccan = isMoroccanTaxFormType(form.formType);
  const employeeContributions = data.employee_contributions as
    | ContributionData
    | undefined;
  const employerContributions = data.employer_contributions as
    | ContributionData
    | undefined;
  const employees = Array.isArray(data.employees)
    ? (data.employees as CnssEmployeeLine[])
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="size-8 p-0">
            <Link href="/payroll/tax-forms" aria-label={t("taxForms.back")}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold tracking-tight">
                {formTypeLabel(form.formType)} · {form.taxYear}
              </h1>
              {statusBadge(form.status)}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {form.recipientName}
            </p>
          </div>
        </div>
        {!isMoroccan && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(`/api/v1/payroll/tax-forms/${form.id}/pdf`, "_blank")
            }
          >
            <Download className="mr-2 size-3.5" />
            {t("taxForms.downloadJson")}
          </Button>
        )}
      </div>

      <div className="h-px bg-gradient-to-r from-blue-500/20 via-border to-transparent" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          [t("taxForms.summary.formType"), formTypeLabel(form.formType)],
          [t("taxForms.summary.taxYear"), String(form.taxYear)],
          [t("taxForms.summary.recipient"), form.recipientName],
          [
            t("taxForms.summary.taxId"),
            form.recipientTaxId ? `***-${form.recipientTaxId.slice(-4)}` : "-",
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>

      {isMoroccan && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          {t("taxForms.disclaimer")}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">{t("taxForms.formData")}</h2>
        <div className="divide-y rounded-lg border">
          {form.formType === "1099_nec" &&
            moneyRow(
              "Box 1 - Nonemployee Compensation",
              data.box1_nonemployee_compensation
            )}

          {form.formType === "w2" &&
            Object.entries(w2Labels).map(([key, label]) => (
              <div key={key}>{moneyRow(label, data[key])}</div>
            ))}

          {form.formType === "ma_cnss_declaration" && (
            <>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {t("taxForms.summary.period")}
                </span>
                <span className="text-sm font-medium">
                  {String(data.period_start)} – {String(data.period_end)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {t("taxForms.summary.employeeCount")}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums">
                  {String(data.employee_count ?? 0)}
                </span>
              </div>
              {moneyRow(
                t("taxForms.summary.grossWages"),
                data.total_gross_wages
              )}
              {moneyRow(
                t("taxForms.summary.employeeContributions"),
                employeeContributions?.total
              )}
              {moneyRow(
                t("taxForms.summary.employerContributions"),
                employerContributions?.total
              )}
              {moneyRow(
                t("taxForms.summary.totalContributions"),
                data.total_social_contributions
              )}
            </>
          )}

          {form.formType === "ma_ir_annual_summary" && (
            <>
              {moneyRow(
                t("taxForms.summary.grossWages"),
                data.annual_gross_wages
              )}
              {moneyRow(
                t("taxForms.summary.taxableWages"),
                data.annual_taxable_wages
              )}
              {moneyRow(t("taxForms.summary.irWithheld"), data.ir_withheld)}
              {moneyRow(
                t("taxForms.summary.employeeContributions"),
                (data.employee_social_contributions as ContributionData | undefined)
                  ?.total
              )}
              {moneyRow(
                t("taxForms.summary.employerContributions"),
                (data.employer_social_contributions as ContributionData | undefined)
                  ?.total
              )}
            </>
          )}
        </div>
      </div>

      {form.formType === "ma_cnss_declaration" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">
              {t("taxForms.summary.employeeContributions")}
            </h2>
            <div className="rounded-lg border">
              {contributionRows(employeeContributions)}
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">
              {t("taxForms.summary.employerContributions")}
            </h2>
            <div className="rounded-lg border">
              {contributionRows(employerContributions)}
            </div>
          </section>
        </div>
      )}

      {form.formType === "ma_cnss_declaration" && employees.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            {t("taxForms.employeeBreakdown")}
          </h2>
          <div className="space-y-3">
            {employees.map((employee) => (
              <div key={employee.employee_id} className="rounded-lg border">
                <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{employee.employee_name}</p>
                    {employee.employee_number && (
                      <p className="text-xs text-muted-foreground">
                        {employee.employee_number}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {formatMoney(employee.total_social_contributions)}
                  </span>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("taxForms.summary.grossWages")}
                    </p>
                    <p className="font-mono text-sm font-medium">
                      {formatMoney(employee.gross_wages)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("taxForms.summary.employeeContributions")}
                    </p>
                    <p className="font-mono text-sm font-medium">
                      {formatMoney(employee.employee_contributions.total ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("taxForms.summary.employerContributions")}
                    </p>
                    <p className="font-mono text-sm font-medium">
                      {formatMoney(employee.employer_contributions.total ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
