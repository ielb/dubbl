"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, FileText, X, Banknote, Search, Loader2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { devDelay } from "@/lib/dev-delay";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ErrorState } from "@/components/dashboard/error-state";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useOrganization } from "@/components/dashboard/org-loader";

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  total: number;
  amountDue: number;
  currencyCode: string;
  contact: { name: string } | null;
}

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  date: string;
  amount: number;
  method: string;
  contact: { name: string } | null;
  allocations: { documentType: string; documentId: string; amount: number }[];
}

const statusColors: Record<string, string> = {
  draft: "",
  sent: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  partial: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  overdue: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

interface InvoiceColumnCopy {
  number: string;
  customer: string;
  date: string;
  due: string;
  statusLabel: string;
  total: string;
  balance: string;
  selectInvoice: (number: string) => string;
  dueToday: string;
  dueIn: (days: number) => string;
  daysOverdue: (days: number) => string;
  statuses: Record<string, string>;
}

function getOverdueInfo(
  dueDate: string,
  status: string,
  copy: Pick<InvoiceColumnCopy, "dueToday" | "dueIn" | "daysOverdue">
) {
  if (status === "paid" || status === "void" || status === "draft") return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = now.getTime() - due.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) {
    const daysLeft = Math.abs(days);
    if (daysLeft === 0) return { label: copy.dueToday, color: "text-amber-600" };
    if (daysLeft <= 7) return { label: copy.dueIn(daysLeft), color: "text-muted-foreground" };
    return null;
  }
  if (days <= 30) return { label: copy.daysOverdue(days), color: "text-red-500" };
  if (days <= 90) return { label: copy.daysOverdue(days), color: "text-red-600 font-medium" };
  return { label: copy.daysOverdue(days), color: "text-red-700 font-semibold" };
}

function buildColumns(
  selectedIds: Set<string>,
  toggleOne: (id: string) => void,
  copy: InvoiceColumnCopy
): Column<Invoice>[] {
  return [
    {
      key: "select",
      header: "",
      className: "w-10",
      render: (r) => (
        <div
          // Stop the row's navigation click from firing when ticking the box.
          onClick={(e) => e.stopPropagation()}
          className="flex items-center"
        >
          <Checkbox
            checked={selectedIds.has(r.id)}
            onCheckedChange={() => toggleOne(r.id)}
            aria-label={copy.selectInvoice(r.invoiceNumber)}
          />
        </div>
      ),
    },
    {
      key: "number",
      header: copy.number,
      sortKey: "number",
      className: "w-32",
      render: (r) => <span className="font-mono text-sm">{r.invoiceNumber}</span>,
    },
    {
      key: "contact",
      header: copy.customer,
      render: (r) => <span className="text-sm font-medium">{r.contact?.name || "-"}</span>,
    },
    {
      key: "date",
      header: copy.date,
      sortKey: "date",
      className: "w-28",
      render: (r) => <span className="text-sm">{r.issueDate}</span>,
    },
    {
      key: "due",
      header: copy.due,
      sortKey: "due",
      className: "w-36",
      render: (r) => {
        const info = getOverdueInfo(r.dueDate, r.status, copy);
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm">{r.dueDate}</span>
            {info && (
              <span className={`text-[11px] ${info.color}`}>{info.label}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: copy.statusLabel,
      className: "w-24",
      render: (r) => (
        <Badge variant="outline" className={statusColors[r.status] || ""}>
          {copy.statuses[r.status] || r.status}
        </Badge>
      ),
    },
    {
      key: "total",
      header: copy.total,
      sortKey: "total",
      className: "w-28 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">{formatMoney(r.total, r.currencyCode)}</span>
      ),
    },
    {
      key: "due-amount",
      header: copy.balance,
      sortKey: "amountDue",
      className: "w-28 text-right",
      render: (r) => {
        const color = r.amountDue < 0
          ? "text-emerald-600"
          : r.amountDue > 0 && r.status !== "draft"
            ? "text-amber-600"
            : "";
        return (
          <span className={`font-mono text-sm tabular-nums ${color}`}>
            {formatMoney(r.amountDue, r.currencyCode)}
          </span>
        );
      },
    },
  ];
}

export default function InvoicesPage() {
  const t = useTranslations("Sales");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const currency = useOrganization()?.defaultCurrency ?? "USD";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchKey, setFetchKey] = useState(0);
  const [summary, setSummary] = useState<{
    totalCount: number;
    outstanding: number;
    overdue: number;
    aging: Record<string, { count: number; amount: number }>;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Bulk selection of invoice rows.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const PAGE_SIZE = 50;
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const columns = useMemo(
    () => buildColumns(selectedIds, toggleOne, {
      number: t("invoices.number"),
      customer: t("invoices.customer"),
      date: t("invoices.date"),
      due: t("invoices.due"),
      statusLabel: t("invoices.statusLabel"),
      total: t("invoices.total"),
      balance: t("invoices.balance"),
      selectInvoice: (number) => t("invoices.selectInvoice", { number }),
      dueToday: t("invoices.dueToday"),
      dueIn: (days) => t("invoices.dueIn", { days }),
      daysOverdue: (days) => t("invoices.daysOverdue", { days }),
      statuses: {
        draft: t("invoices.status.draft"),
        sent: t("invoices.status.sent"),
        partial: t("invoices.status.partial"),
        paid: t("invoices.status.paid"),
        overdue: t("invoices.status.overdue"),
        void: t("invoices.status.void"),
      },
    }),
    [selectedIds, t, toggleOne]
  );

  const buildParams = useCallback((p: number) => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sortBy !== "created") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("page", String(p));
    params.set("limit", String(PAGE_SIZE));
    return params;
  }, [statusFilter, sortBy, sortOrder, dateFrom, dateTo]);

  // Fetch first page when filters change
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setRefetching(true);
    setPage(1);

    fetch(`/api/v1/invoices?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setInvoices(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      })
      .then(() => devDelay())
      .catch(() => { if (!cancelled) setError(t("invoices.loadFailed")); })
      .finally(() => { if (!cancelled) { setInitialLoad(false); setRefetching(false); setFetchKey((k) => k + 1); } });

    return () => { cancelled = true; };
  }, [orgId, buildParams, t]);

  // Load more
  const loadMore = useCallback(() => {
    if (!orgId || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);

    fetch(`/api/v1/invoices?${buildParams(nextPage)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          setInvoices((prev) => [...prev, ...data.data]);
          setPage(nextPage);
        }
      })
      .finally(() => setLoadingMore(false));
  }, [orgId, page, buildParams, loadingMore]);

  const hasMore = invoices.length < totalCount;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !refetching) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, refetching]);

  // Fetch summary stats and recent payments (independent of filters)
  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/v1/invoices/summary`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => setSummary(data));

    fetch(`/api/v1/payments?type=received&limit=5`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setPayments(data.data);
      });
  }, [orgId]);

  const handleSort = useCallback((key: string) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
        return key;
      }
      setSortOrder("desc");
      return key;
    });
  }, []);

  const hasFilters = search || dateFrom || dateTo;
  const pendingSearch = search !== debouncedSearch;

  const [searchKey, setSearchKey] = useState(0);
  const filteredInvoices = useMemo(() => {
    if (!debouncedSearch) return invoices;
    const q = debouncedSearch.toLowerCase();
    return invoices.filter(
      (i) =>
        i.invoiceNumber.toLowerCase().includes(q) ||
        (i.contact?.name || "").toLowerCase().includes(q)
    );
  }, [invoices, debouncedSearch]);

  // Bump searchKey when debounced search changes to trigger ContentReveal
  useEffect(() => {
    setSearchKey((k) => k + 1);
  }, [debouncedSearch]);

  // Drop any selected ids that fall out of the current filtered view so the
  // selection (and the bulk toolbar count) always reflects what's visible.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(filteredInvoices.map((i) => i.id));
      const next = new Set<string>();
      for (const id of prev) if (visible.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [filteredInvoices]);

  const selectedInvoices = useMemo(
    () => filteredInvoices.filter((i) => selectedIds.has(i.id)),
    [filteredInvoices, selectedIds]
  );
  // "Reminder-eligible" = something is still owed (not draft/paid/cancelled).
  const remindableSelected = useMemo(
    () => selectedInvoices.filter((i) => !["draft", "void", "paid"].includes(i.status)),
    [selectedInvoices]
  );
  // "Mark as sent" only applies to drafts.
  const draftSelected = useMemo(
    () => selectedInvoices.filter((i) => i.status === "draft"),
    [selectedInvoices]
  );

  const allVisibleSelected =
    filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length;
  const someVisibleSelected = selectedIds.size > 0 && !allVisibleSelected;

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredInvoices.length) return new Set();
      return new Set(filteredInvoices.map((i) => i.id));
    });
  }, [filteredInvoices]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Refresh the visible rows + summary after a bulk action mutates statuses.
  const refreshList = useCallback(() => {
    if (!orgId) return;
    fetch(`/api/v1/invoices?${buildParams(1)}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        setInvoices(data.data || []);
        setTotalCount(data.pagination?.total || 0);
        setPage(1);
        setFetchKey((k) => k + 1);
      })
      .catch(() => {});
    fetch(`/api/v1/invoices/summary`, { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => setSummary(data))
      .catch(() => {});
  }, [orgId, buildParams]);

  const runBulkAction = useCallback(
    async (action: "send-reminder" | "mark-as-sent", ids: string[]) => {
      if (!orgId || ids.length === 0 || bulkRunning) return;
      setBulkRunning(true);
      try {
        const res = await fetch(`/api/v1/invoices/bulk`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-organization-id": orgId,
          },
          body: JSON.stringify({ action, invoiceIds: ids }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : t("invoices.bulkFailed"));
          return;
        }
        const s = data.summary || { sent: 0, skipped: 0, failed: 0, total: 0 };
        const msg = t("invoices.bulkResult", {
          sent: s.sent,
          skipped: s.skipped,
          failed: s.failed,
        });
        if (s.failed) toast.error(msg);
        else toast.success(msg);
        clearSelection();
        if (action === "mark-as-sent" && s.sent) refreshList();
      } catch {
        toast.error(t("invoices.bulkFailed"));
      } finally {
        setBulkRunning(false);
      }
    },
    [orgId, bulkRunning, clearSelection, refreshList, t]
  );

  const outstanding = summary?.outstanding || 0;
  const overdue = summary?.overdue || 0;
  const invoiceCount = summary?.totalCount || 0;

  const aging = summary?.aging || {
    current: { count: 0, amount: 0 },
    "1-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 },
    "60+": { count: 0, amount: 0 },
  };
  const agingTotal = (aging.current?.amount || 0) + (aging["1-30"]?.amount || 0) + (aging["31-60"]?.amount || 0) + (aging["60+"]?.amount || 0);

  if (initialLoad) return <BrandLoader />;

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  if (!initialLoad && !refetching && invoices.length === 0 && statusFilter === "all" && !hasFilters) {
    return (
      <ContentReveal>
        <div className="flex flex-col items-center gap-10 pt-16 pb-12">
          {/* Invoice lifecycle stepper */}
          <div className="w-full max-w-xl">
            <div className="grid grid-cols-3 gap-0">
              {[
                { step: "1", label: t("invoices.create"), sub: t("invoices.createDescription"), color: "bg-blue-500", ring: "ring-blue-200 dark:ring-blue-900" },
                { step: "2", label: t("invoices.send"), sub: t("invoices.sendDescription"), color: "bg-amber-500", ring: "ring-amber-200 dark:ring-amber-900" },
                { step: "3", label: t("invoices.getPaid"), sub: t("invoices.getPaidDescription"), color: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-900" },
              ].map(({ step, label, sub, color, ring }, i) => (
                <div key={step} className="flex flex-col items-center text-center relative">
                  {i < 2 && (
                    <div className="absolute top-4 left-[calc(50%+16px)] w-[calc(100%-32px)] h-px bg-border" />
                  )}
                  <div className={`relative z-10 flex size-8 items-center justify-center rounded-full ${color} ring-4 ${ring} text-white text-xs font-bold`}>
                    {step}
                  </div>
                  <p className="mt-3 text-sm font-medium">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-[150px] leading-relaxed">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-lg font-semibold tracking-tight">{t("invoices.emptyTitle")}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("invoices.emptyDescription")}</p>
            <Button
              onClick={() => openDrawer("invoice")}
              size="lg"
              className="mt-5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 size-4" />
              {t("invoices.newInvoice")}
            </Button>
          </div>

          {/* Preview stat cards (empty) */}
          <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-3 gap-3 opacity-40">
            {[
              { label: t("invoices.outstanding"), value: formatMoney(0, currency) },
              { label: t("invoices.status.overdue"), value: formatMoney(0, currency) },
              { label: t("invoices.paidThisMonth"), value: formatMoney(0, currency) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-dashed p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-mono font-medium text-muted-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      {/* Top: Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title={t("invoices.outstanding")} value={formatMoney(outstanding, currency)} icon={FileText} />
        <StatCard title={t("invoices.status.overdue")} value={formatMoney(overdue, currency)} icon={FileText} changeType="negative" />
        <StatCard title={t("invoices.totalInvoices")} value={invoiceCount.toString()} icon={FileText} />
      </div>

      {/* Aging + Recent Payments side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Aging Breakdown */}
        {agingTotal > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("invoices.agingBreakdown")}</p>
            <div className="h-2.5 w-full rounded-full overflow-hidden flex">
              {([
                { key: "current" as const, color: "bg-emerald-500" },
                { key: "1-30" as const, color: "bg-amber-400" },
                { key: "31-60" as const, color: "bg-orange-500" },
                { key: "60+" as const, color: "bg-red-500" },
              ] as const).map(({ key, color }) => {
                const bucket = aging[key];
                const pct = bucket ? (bucket.amount / agingTotal) * 100 : 0;
                if (pct === 0) return null;
                return <div key={key} className={`${color} h-full`} style={{ width: `${pct}%` }} />;
              })}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {([
                { key: "current" as const, color: "bg-emerald-500", label: t("invoices.current") },
                { key: "1-30" as const, color: "bg-amber-400", label: t("invoices.days1to30") },
                { key: "31-60" as const, color: "bg-orange-500", label: t("invoices.days31to60") },
                { key: "60+" as const, color: "bg-red-500", label: t("invoices.days60plus") },
              ] as const).map(({ key, color, label }) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block size-2 rounded-full ${color}`} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <span className="font-mono tabular-nums">
                    {aging[key]?.count || 0} · {formatMoney(aging[key]?.amount || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Payments */}
        {payments.length > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("invoices.recentPayments")}</p>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2" onClick={() => router.push("/sales/payments")}>
                {t("invoices.viewAll")}
              </Button>
            </div>
            <div className="space-y-0.5">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Banknote className="size-3.5 text-emerald-600 shrink-0" />
                    <span className="font-mono text-xs">{p.paymentNumber}</span>
                    <span className="text-xs text-muted-foreground truncate">{p.contact?.name || "-"}</span>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">{p.date}</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-emerald-600 shrink-0 ml-2">
                    {formatMoney(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Invoice table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="all" className="whitespace-nowrap">{t("invoices.status.all")}</TabsTrigger>
              <TabsTrigger value="draft" className="whitespace-nowrap">{t("invoices.status.draft")}</TabsTrigger>
              <TabsTrigger value="sent" className="whitespace-nowrap">{t("invoices.status.sent")}</TabsTrigger>
              <TabsTrigger value="partial" className="whitespace-nowrap">{t("invoices.status.partial")}</TabsTrigger>
              <TabsTrigger value="paid" className="whitespace-nowrap">{t("invoices.status.paid")}</TabsTrigger>
              <TabsTrigger value="overdue" className="whitespace-nowrap">{t("invoices.status.overdue")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={() => openDrawer("invoice")}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 size-4" />
            {t("invoices.newInvoice")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder={t("invoices.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("invoices.from")}</span>
            <DatePicker
              value={dateFrom}
              onChange={(v) => setDateFrom(v)}
              placeholder={t("invoices.startDate")}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">{t("invoices.to")}</span>
            <DatePicker
              value={dateTo}
              onChange={(v) => setDateTo(v)}
              placeholder={t("invoices.endDate")}
              className="h-8 w-40 text-xs"
            />
          </div>
          <Select
            value={`${sortBy}:${sortOrder}`}
            onValueChange={(v) => {
              const [key, order] = v.split(":");
              setSortBy(key);
              setSortOrder(order as "asc" | "desc");
            }}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder={t("invoices.sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created:desc">{t("invoices.newest")}</SelectItem>
              <SelectItem value="created:asc">{t("invoices.oldest")}</SelectItem>
              <SelectItem value="due:asc">{t("invoices.dueSoonest")}</SelectItem>
              <SelectItem value="due:desc">{t("invoices.dueLatest")}</SelectItem>
              <SelectItem value="total:desc">{t("invoices.highestAmount")}</SelectItem>
              <SelectItem value="total:asc">{t("invoices.lowestAmount")}</SelectItem>
              <SelectItem value="amountDue:desc">{t("invoices.highestBalance")}</SelectItem>
              <SelectItem value="number:desc">{t("invoices.numberDesc")}</SelectItem>
              <SelectItem value="number:asc">{t("invoices.numberAsc")}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
            >
              <X className="mr-1 size-3" />
              {t("invoices.clearFilters")}
            </Button>
          )}
        </div>

        {/* Bulk-actions toolbar — appears once one or more rows are ticked. */}
        {!refetching && !pendingSearch && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <Checkbox
              checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              aria-label={t("invoices.selectAll")}
            />
            <span className="text-xs font-medium">
              {t("invoices.selected", { count: selectedIds.size })}
            </span>
            <div className="h-4 w-px bg-border mx-1" />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={bulkRunning || remindableSelected.length === 0}
              onClick={() => runBulkAction("send-reminder", remindableSelected.map((i) => i.id))}
            >
              {bulkRunning ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 size-3.5" />
              )}
              {t("invoices.sendReminder")}
              {remindableSelected.length > 0 && ` (${remindableSelected.length})`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={bulkRunning || draftSelected.length === 0}
              onClick={() => runBulkAction("mark-as-sent", draftSelected.map((i) => i.id))}
            >
              {bulkRunning ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 size-3.5" />
              )}
              {t("invoices.markAsSent")}
              {draftSelected.length > 0 && ` (${draftSelected.length})`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground ml-auto"
              onClick={clearSelection}
              disabled={bulkRunning}
            >
              <X className="mr-1 size-3" />
              {t("invoices.clear")}
            </Button>
          </div>
        )}

        {refetching || pendingSearch ? (
          <BrandLoader className="h-48" />
        ) : (
          <ContentReveal key={`${fetchKey}-${searchKey}`}>
            <DataTable
              columns={columns}
              data={filteredInvoices}
              loading={false}
              emptyMessage={t("invoices.noMatches")}
              onRowClick={(r) => router.push(`/sales/${r.id}`)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          </ContentReveal>
        )}

        {/* Infinite scroll sentinel & count */}
        {!refetching && !pendingSearch && filteredInvoices.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {t("invoices.showing", { shown: invoices.length, total: totalCount })}
              </p>
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                {loadingMore && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>
            )}
          </>
        )}
      </div>
    </ContentReveal>
  );
}
