"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { isMoroccanTaxFormType } from "@/lib/payroll/morocco-tax-forms";

type TaxFormType =
  | "1099_nec"
  | "1099_misc"
  | "w2"
  | "ma_cnss_declaration"
  | "ma_ir_annual_summary";

interface TaxFormItem {
  id: string;
  recipientName: string;
  recipientTaxId: string | null;
  formType: TaxFormType;
  taxYear: number;
  formData: Record<string, unknown>;
  status: string;
}

interface TaxGeneration {
  id: string;
  taxYear: number;
  formType: TaxFormType;
  status: string;
  generatedAt: string | null;
  createdAt: string;
  forms: TaxFormItem[];
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 7 }, (_, index) => currentYear - index);
const months = Array.from({ length: 12 }, (_, index) => index + 1);

export default function TaxFormsPage() {
  const t = useTranslations("Payroll");
  const locale = useLocale();
  const router = useRouter();
  const [generations, setGenerations] = useState<TaxGeneration[]>([]);
  const [payrollCountry, setPayrollCountry] = useState<"US" | "MA">("US");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [taxYear, setTaxYear] = useState(String(currentYear));
  const [taxMonth, setTaxMonth] = useState(String(new Date().getMonth() + 1));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useDocumentTitle(t("taxForms.documentTitle"));

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId") || ""
      : "";

  const fetchGenerations = useCallback(() => {
    if (!orgId) return;
    const headers = { "x-organization-id": orgId };
    Promise.all([
      fetch("/api/v1/payroll/tax-forms", { headers }).then((response) =>
        response.json()
      ),
      fetch("/api/v1/payroll/settings", { headers }).then((response) =>
        response.json()
      ),
    ])
      .then(([generationData, settingsData]) => {
        if (generationData.data) setGenerations(generationData.data);
        if (settingsData.settings?.country === "MA") setPayrollCountry("MA");
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

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

  function formatMoney(cents: number, formType: TaxFormType) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: isMoroccanTaxFormType(formType) ? "MAD" : "USD",
    }).format(cents / 100);
  }

  async function handleGenerate(formType: TaxFormType) {
    setGenerating(true);
    try {
      const response = await fetch("/api/v1/payroll/tax-forms/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          taxYear: Number(taxYear),
          formType,
          ...(formType === "ma_cnss_declaration"
            ? { taxMonth: Number(taxMonth) }
            : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("taxForms.generateFailed"));
      }

      const data = await response.json();
      toast.success(
        t("taxForms.generatedToast", {
          count: data.formsGenerated,
          formType: formTypeLabel(formType),
        })
      );
      fetchGenerations();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("taxForms.generateFailed")
      );
    } finally {
      setGenerating(false);
    }
  }

  function maskTaxId(taxId: string | null) {
    if (!taxId) return "-";
    return `***-${taxId.slice(-4)}`;
  }

  function getKeyAmount(form: TaxFormItem) {
    const data = form.formData as Record<string, number>;
    const amount =
      form.formType === "1099_nec"
        ? data.box1_nonemployee_compensation
        : form.formType === "w2"
          ? data.box1_wages
          : form.formType === "ma_cnss_declaration"
            ? data.total_social_contributions
            : form.formType === "ma_ir_annual_summary"
              ? data.ir_withheld
              : undefined;
    return typeof amount === "number" ? formatMoney(amount, form.formType) : "-";
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("taxForms.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {t("taxForms.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              payrollCountry === "MA"
                ? "taxForms.descriptionMA"
                : "taxForms.descriptionUS"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={taxYear} onValueChange={setTaxYear}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder={t("taxForms.year")} />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {payrollCountry === "MA" ? (
            <>
              <Select value={taxMonth} onValueChange={setTaxMonth}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("taxForms.month")} />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={String(month)}>
                      {t(`taxForms.months.${month}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={generating}
                onClick={() => handleGenerate("ma_cnss_declaration")}
              >
                {generating
                  ? t("taxForms.generating")
                  : t("taxForms.generateCnss")}
              </Button>
              <Button
                size="sm"
                disabled={generating}
                onClick={() => handleGenerate("ma_ir_annual_summary")}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {generating
                  ? t("taxForms.generating")
                  : t("taxForms.generateIr")}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={generating}
                onClick={() => handleGenerate("1099_nec")}
              >
                {generating
                  ? t("taxForms.generating")
                  : t("taxForms.generate1099")}
              </Button>
              <Button
                size="sm"
                disabled={generating}
                onClick={() => handleGenerate("w2")}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {generating
                  ? t("taxForms.generating")
                  : t("taxForms.generateW2")}
              </Button>
            </>
          )}
        </div>
      </div>

      {payrollCountry === "MA" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          {t("taxForms.disclaimer")}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("taxForms.table.taxYear")}</TableHead>
              <TableHead>{t("taxForms.table.formType")}</TableHead>
              <TableHead>{t("taxForms.table.status")}</TableHead>
              <TableHead className="text-right">
                {t("taxForms.table.forms")}
              </TableHead>
              <TableHead>{t("taxForms.table.generated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  {t("taxForms.empty")}
                </TableCell>
              </TableRow>
            ) : (
              generations.map((generation) => (
                <Fragment key={generation.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(
                        expandedId === generation.id ? null : generation.id
                      )
                    }
                  >
                    <TableCell className="font-mono text-sm">
                      {generation.taxYear}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formTypeLabel(generation.formType)}
                    </TableCell>
                    <TableCell>{statusBadge(generation.status)}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {generation.forms?.length || 0}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {generation.generatedAt
                        ? new Date(generation.generatedAt).toLocaleDateString(
                            locale
                          )
                        : "-"}
                    </TableCell>
                  </TableRow>

                  {expandedId === generation.id &&
                    generation.forms &&
                    generation.forms.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <div className="bg-muted/30 px-4 py-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>
                                    {t("taxForms.table.recipient")}
                                  </TableHead>
                                  <TableHead>{t("taxForms.table.taxId")}</TableHead>
                                  <TableHead className="text-right">
                                    {t("taxForms.table.keyAmount")}
                                  </TableHead>
                                  <TableHead>{t("taxForms.table.status")}</TableHead>
                                  <TableHead className="text-right">
                                    {t("taxForms.table.actions")}
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {generation.forms.map((form) => (
                                  <TableRow
                                    key={form.id}
                                    className="cursor-pointer"
                                    onClick={() =>
                                      router.push(`/payroll/tax-forms/${form.id}`)
                                    }
                                  >
                                    <TableCell className="font-medium">
                                      {form.recipientName}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm text-muted-foreground">
                                      {maskTaxId(form.recipientTaxId)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm tabular-nums">
                                      {getKeyAmount(form)}
                                    </TableCell>
                                    <TableCell>{statusBadge(form.status)}</TableCell>
                                    <TableCell className="text-right">
                                      {!isMoroccanTaxFormType(form.formType) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          aria-label={t("taxForms.downloadJson")}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            window.open(
                                              `/api/v1/payroll/tax-forms/${form.id}/pdf`,
                                              "_blank"
                                            );
                                          }}
                                        >
                                          <Download className="size-3.5" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
