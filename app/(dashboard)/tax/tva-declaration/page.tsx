"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, Printer } from "lucide-react";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useOrganization } from "@/components/dashboard/org-loader";
import { useLocale, useTranslations } from "next-intl";

interface TvaBox {
  box: string;
  label: string;
  amount: number;
}

const KEY_BOX = "4";

export default function TvaDeclarationPage() {
  const t = useTranslations("Tax");
  const locale = useLocale();
  const now = new Date();
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [boxes, setBoxes] = useState<TvaBox[]>([]);
  const [loading, setLoading] = useState(true);
  const currency = useOrganization()?.defaultCurrency ?? "USD";
  useDocumentTitle(t("tva.documentTitle"));

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;
    const params = new URLSearchParams({ startDate, endDate });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/v1/reports/tva-declaration?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setBoxes(data.boxes || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const outputTva = boxes.find((b) => b.box === "2")?.amount || 0;
  const inputTva = boxes.find((b) => b.box === "3")?.amount || 0;
  const netTva = boxes.find((b) => b.box === KEY_BOX)?.amount || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tva.title")}
        description={t("tva.description")}
      >
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          {t("tva.print")}
        </Button>
        <ExportButton
          data={boxes.map((b) => ({
            box: b.box,
            description: t(`tva.boxes.${b.box}`),
            amount: b.amount,
          }))}
          columns={["box", "description", "amount"]}
          filename="tva-declaration"
        />
      </PageHeader>

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      {loading ? (
        <BrandLoader className="h-48" />
      ) : (
        <ContentReveal className="space-y-6">
          <div className={cn(
            "rounded-xl border-2 p-5",
            netTva >= 0
              ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20"
              : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  Box 4 · {netTva >= 0 ? t("tva.due") : t("tva.credit")}
                </p>
                <p className={cn(
                  "mt-1 text-2xl font-bold font-mono tabular-nums",
                  netTva >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {formatMoney(Math.abs(netTva), currency, locale)}
                </p>
              </div>
              <div className={cn(
                "flex size-12 items-center justify-center rounded-xl",
                netTva >= 0
                  ? "bg-red-100 dark:bg-red-900/40"
                  : "bg-emerald-100 dark:bg-emerald-900/40"
              )}>
                {netTva >= 0 ? (
                  <ArrowUpRight className="size-5 text-red-600 dark:text-red-400" />
                ) : (
                  <ArrowDownLeft className="size-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {t("tva.allBoxes")}
            </h3>
            <div className="rounded-lg border overflow-hidden">
              {boxes.map((b, i) => {
                const isKey = b.box === KEY_BOX;
                const isCalc = isKey;
                return (
                  <div
                    key={b.box}
                    className={cn(
                      "flex items-center justify-between px-4 py-3.5",
                      i < boxes.length - 1 && "border-b",
                      isKey && "bg-emerald-50/60 dark:bg-emerald-950/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex size-8 items-center justify-center rounded-md text-xs font-bold font-mono",
                        isKey
                          ? "bg-emerald-600 text-white dark:bg-emerald-500"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {b.box}
                      </div>
                      <div>
                        <p className={cn("text-sm", isKey && "font-semibold")}>
                          {t(`tva.boxes.${b.box}`)}
                        </p>
                        {isCalc && (
                          <Badge variant="outline" className="text-[9px] mt-0.5">{t("tva.calculated")}</Badge>
                        )}
                      </div>
                    </div>
                    <p className={cn(
                      "font-mono text-sm tabular-nums",
                      isKey ? "text-base font-bold" : "font-medium",
                      isKey && netTva >= 0 && "text-red-600 dark:text-red-400",
                      isKey && netTva < 0 && "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {formatMoney(Math.abs(b.amount), currency, locale)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Output vs Input, for orientation */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("tva.comparison")}
            </h3>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("tva.output")}</span>
              <span className="font-mono tabular-nums font-medium">{formatMoney(outputTva, currency, locale)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("tva.input")}</span>
              <span className="font-mono tabular-nums font-medium">{formatMoney(inputTva, currency, locale)}</span>
            </div>
          </div>
        </ContentReveal>
      )}
    </div>
  );
}
