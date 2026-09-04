"use client";

import { useState, useEffect } from "react";
import { Percent, Coins, Calendar, Globe, FileSpreadsheet, MapPin, Calculator } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";
import { useTranslations } from "next-intl";

const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

function getFilingTabs(
  countryCode: string | null,
  labels: {
    vatReturn: string;
    bas: string;
    salesTax: string;
    scheduleC: string;
    tvaDeclaration: string;
  }
) {
  if (!countryCode) return [];

  const tabs: { href: string; label: string; icon: typeof Percent }[] = [];

  if (countryCode === "GB" || EU_COUNTRIES.includes(countryCode)) {
    tabs.push({ href: "/tax/vat-return", label: labels.vatReturn, icon: Globe });
  }

  if (countryCode === "AU") {
    tabs.push({ href: "/tax/bas", label: labels.bas, icon: FileSpreadsheet });
  }

  if (countryCode === "US") {
    tabs.push(
      { href: "/tax/sales-tax", label: labels.salesTax, icon: MapPin },
      { href: "/tax/schedule-c", label: labels.scheduleC, icon: Calculator },
    );
  }

  if (countryCode === "MA") {
    tabs.push({ href: "/tax/tva-declaration", label: labels.tvaDeclaration, icon: Globe });
  }

  return tabs;
}

export default function TaxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("Tax");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [openPeriods, setOpenPeriods] = useState(0);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    const headers = { "x-organization-id": orgId };

    fetch("/api/v1/organization", { headers })
      .then((r) => r.json())
      .then((data) => {
        const code = data.organization?.countryCode || data.countryCode;
        if (code) setCountryCode(code);
      })
      .catch(() => {});

    fetch("/api/v1/tax-periods", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.taxPeriods) {
          const open = data.taxPeriods.filter((p: { status: string }) => p.status === "open").length;
          setOpenPeriods(open);
        }
      })
      .catch(() => {});
  }, []);

  const baseTabs = [
    { href: "/tax", label: t("tabs.taxRates"), icon: Percent, exact: true },
    { href: "/tax/currencies", label: t("tabs.currencies"), icon: Coins },
    { href: "/tax/periods", label: t("tabs.taxPeriods"), icon: Calendar, badge: openPeriods > 0 ? openPeriods : undefined },
  ];

  const tabs = [
    ...baseTabs,
    ...getFilingTabs(countryCode, {
      vatReturn: t("tabs.vatReturn"),
      bas: t("tabs.bas"),
      salesTax: t("tabs.salesTax"),
      scheduleC: t("tabs.scheduleC"),
      tvaDeclaration: t("tabs.tvaDeclaration"),
    }),
  ];

  return <TabLayout tabs={tabs}>{children}</TabLayout>;
}
