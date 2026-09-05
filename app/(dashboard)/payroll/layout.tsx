"use client";

import {
  LayoutDashboard,
  Users,
  FileText,
  Clock,
  Briefcase,
  BarChart3,
  DollarSign,
  Settings,
  Landmark,
  FileSpreadsheet,
} from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";
import { useTranslations } from "next-intl";

export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("Payroll");
  const tabs = [
    { href: "/payroll", label: t("tabs.overview"), icon: LayoutDashboard, exact: true },
    { href: "/payroll/employees", label: t("tabs.employees"), icon: Users },
    { href: "/payroll/runs", label: t("tabs.runs"), icon: FileText },
    { href: "/payroll/tax-liabilities", label: t("tabs.taxLiabilities"), icon: Landmark, title: t("tabs.taxLiabilitiesHelp") },
    { href: "/payroll/time-leave", label: t("tabs.timeLeave"), icon: Clock },
    { href: "/payroll/contractors", label: t("tabs.contractors"), icon: Briefcase },
    { href: "/payroll/compensation", label: t("tabs.compensation"), icon: DollarSign },
    { href: "/payroll/analytics", label: t("tabs.analytics"), icon: BarChart3 },
    { href: "/payroll/tax-forms", label: t("tabs.filingDocuments"), icon: FileSpreadsheet },
    { href: "/payroll/settings", label: t("tabs.settings"), icon: Settings },
  ];

  return <TabLayout tabs={tabs}>{children}</TabLayout>;
}
