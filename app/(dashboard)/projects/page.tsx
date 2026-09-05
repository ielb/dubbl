"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, FolderKanban, Clock, DollarSign, Target, Users } from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/money";
import { devDelay } from "@/lib/dev-delay";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { cn } from "@/lib/utils";

interface ProjectMember {
  id: string;
  role: string;
  member: {
    id: string;
    user: { name: string | null; email: string; image: string | null };
  };
}

interface Project {
  id: string;
  name: string;
  status: string;
  priority: string;
  billingType: string;
  color: string;
  budget: number;
  hourlyRate: number;
  totalHours: number;
  totalBilled: number;
  estimatedHours: number;
  startDate: string | null;
  endDate: string | null;
  category: string | null;
  tags: string[];
  contact: { name: string } | null;
  members: ProjectMember[];
}

const statusColors: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
  on_hold: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  archived: "border-gray-200 bg-gray-50 text-gray-700",
};

const priorityColors: Record<string, string> = {
  low: "border-gray-200 bg-gray-50 text-gray-600",
  medium: "border-blue-200 bg-blue-50 text-blue-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

function formatHours(minutes: number, hourSuffix: string, minuteSuffix: string): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0
    ? `${hrs}${hourSuffix} ${mins}${minuteSuffix}`
    : `${hrs}${hourSuffix}`;
}

interface ProjectColumnCopy {
  headers: Record<string, string>;
  statuses: Record<string, string>;
  priorities: Record<string, string>;
  hourSuffix: string;
  minuteSuffix: string;
}

function buildColumns(copy: ProjectColumnCopy): Column<Project>[] {
  return [
  {
    key: "name",
    header: copy.headers.project,
    render: (r) => (
      <div className="flex items-center gap-2.5">
        <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
        <div className="min-w-0">
          <span className="text-sm font-medium block truncate">{r.name}</span>
          {r.contact && <span className="text-[11px] text-muted-foreground">{r.contact.name}</span>}
        </div>
      </div>
    ),
  },
  {
    key: "status",
    header: copy.headers.status,
    className: "w-28",
    render: (r) => (
      <Badge variant="outline" className={cn("text-[10px]", statusColors[r.status])}>
        {copy.statuses[r.status] || r.status.replace("_", " ")}
      </Badge>
    ),
  },
  {
    key: "priority",
    header: copy.headers.priority,
    className: "w-24",
    render: (r) => (
      <Badge variant="outline" className={cn("text-[10px]", priorityColors[r.priority])}>
        {copy.priorities[r.priority] || r.priority}
      </Badge>
    ),
  },
  {
    key: "progress",
    header: copy.headers.time,
    className: "w-32",
    render: (r) => {
      const pct = r.estimatedHours > 0 ? Math.round((r.totalHours / r.estimatedHours) * 100) : 0;
      return (
        <div className="space-y-1">
          <span className="text-xs font-mono tabular-nums">
            {formatHours(r.totalHours, copy.hourSuffix, copy.minuteSuffix)}
          </span>
          {r.estimatedHours > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-16 rounded-full bg-muted">
                <div className={cn("h-full rounded-full", pct > 100 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{pct}%</span>
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: "budget",
    header: copy.headers.budget,
    className: "w-28 text-right",
    render: (r) => (
      <span className="font-mono text-xs tabular-nums">
        {r.budget > 0 ? formatMoney(r.budget) : "-"}
      </span>
    ),
  },
  {
    key: "billed",
    header: copy.headers.billed,
    className: "w-28 text-right",
    render: (r) => (
      <span className="font-mono text-xs tabular-nums">{formatMoney(r.totalBilled)}</span>
    ),
  },
  {
    key: "team",
    header: copy.headers.team,
    className: "w-24",
    render: (r) => {
      if (r.members.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      return (
        <div className="flex -space-x-1.5">
          {r.members.slice(0, 3).map((m) => (
            <div key={m.id} className="size-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-medium ring-2 ring-white" title={m.member.user.name || m.member.user.email}>
              {(m.member.user.name || m.member.user.email)[0].toUpperCase()}
            </div>
          ))}
          {r.members.length > 3 && (
            <div className="size-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[9px] font-medium ring-2 ring-white">
              +{r.members.length - 3}
            </div>
          )}
        </div>
      );
    },
  },
  ];
}

export default function ProjectsPage() {
  const t = useTranslations("Projects");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  useDocumentTitle(t("documentTitle"));

  const columns = useMemo(() => buildColumns({
    headers: {
      project: t("columns.project"),
      status: t("columns.status"),
      priority: t("columns.priority"),
      time: t("columns.time"),
      budget: t("columns.budget"),
      billed: t("columns.billed"),
      team: t("columns.team"),
    },
    statuses: {
      active: t("status.active"),
      completed: t("status.completed"),
      on_hold: t("status.on_hold"),
      cancelled: t("status.cancelled"),
      archived: t("status.archived"),
    },
    priorities: {
      low: t("priority.low"),
      medium: t("priority.medium"),
      high: t("priority.high"),
      urgent: t("priority.urgent"),
    },
    hourSuffix: t("hourSuffix"),
    minuteSuffix: t("minuteSuffix"),
  }), [t]);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/v1/projects?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setProjects(data.data);
      })
      .then(() => devDelay())
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const activeProjects = projects.filter((p) => p.status === "active");
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalBilled = projects.reduce((sum, p) => sum + p.totalBilled, 0);
  const totalHours = projects.reduce((sum, p) => sum + p.totalHours, 0);
  const totalMembers = new Set(projects.flatMap(p => p.members.map(m => m.member.id))).size;

  if (loading) return <BrandLoader />;

  if (!loading && projects.length === 0 && statusFilter === "all") {
    return (
      <ContentReveal className="space-y-10">
        <Section title={t("projects")} description={t("emptyDescription")}>
          <EmptyState
            icon={FolderKanban}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          >
            <Button
              onClick={() => openDrawer("project")}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 size-4" />
              {t("newProject")}
            </Button>
          </EmptyState>
        </Section>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal>
    <div className="space-y-6 sm:space-y-8">
      <Section title={t("overview")} description={t("overviewDescription")}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title={t("active")} value={activeProjects.length.toString()} icon={FolderKanban} />
            <StatCard title={t("totalBudget")} value={formatMoney(totalBudget)} icon={DollarSign} />
            <StatCard title={t("totalBilled")} value={formatMoney(totalBilled)} icon={Target}
              change={totalBudget > 0 ? t("ofBudget", { percent: Math.round((totalBilled / totalBudget) * 100) }) : undefined}
            />
            <StatCard title={t("hoursLogged")} value={formatHours(totalHours, t("hourSuffix"), t("minuteSuffix"))} icon={Clock} />
            <StatCard title={t("teamMembers")} value={totalMembers.toString()} icon={Users} />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => openDrawer("project")}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 size-4" />
              {t("newProject")}
            </Button>
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      <Section title={t("projects")} description={t("sectionDescription")}>
        <div className="space-y-4">
          <div className="overflow-x-auto -mx-1 px-1">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">{t("status.all")}</TabsTrigger>
                <TabsTrigger value="active">{t("status.active")}</TabsTrigger>
                <TabsTrigger value="completed">{t("status.completed")}</TabsTrigger>
                <TabsTrigger value="on_hold">{t("status.on_hold")}</TabsTrigger>
                <TabsTrigger value="archived">{t("status.archived")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <DataTable
              columns={columns}
              data={projects}
              loading={loading}
              emptyMessage={t("noProjects")}
              onRowClick={(r) => router.push(`/projects/${r.id}`)}
            />
        </div>
      </Section>
    </div>
    </ContentReveal>
  );
}
