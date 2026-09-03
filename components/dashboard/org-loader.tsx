"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { Logo } from "@/components/shared/logo";

/** The org fields consumers actually need (a subset of the full API response). */
export interface OrganizationData {
  id: string;
  name: string;
  defaultCurrency: string;
  countryCode: string | null;
  onboardingCompletedAt: string | null;
}

const OrganizationContext = createContext<OrganizationData | null>(null);

/**
 * The current org's data, loaded once by OrgLoader (the outermost dashboard
 * wrapper — see app/(dashboard)/layout.tsx) and shared here instead of every
 * page independently re-fetching /api/v1/organization. Null only outside
 * OrgLoader's tree; OrgLoader itself never renders children until this is set.
 */
export function useOrganization(): OrganizationData | null {
  return useContext(OrganizationContext);
}

export function OrgLoader({ children }: { children: React.ReactNode }) {
  const FADE_DURATION_MS = 400;
  const [state, setState] = useState<"loading" | "ready" | "fading">("loading");
  const [org, setOrg] = useState<OrganizationData | null>(null);

  useEffect(() => {
    let isMounted = true;
    let readyTimer: number | null = null;

    const startFadeOut = () => {
      requestAnimationFrame(() => {
        if (!isMounted) return;
        setState("fading");
        readyTimer = window.setTimeout(() => {
          if (isMounted) setState("ready");
        }, FADE_DURATION_MS);
      });
    };

    const orgId = localStorage.getItem("activeOrgId");
    const headers: Record<string, string> = {};
    if (orgId) headers["x-organization-id"] = orgId;

    fetch("/api/v1/organization", { headers })
      .then((r) => r.json())
      .then((data) => {
        // Single org response (header was sent)
        const resolvedOrg = data.organization
          // List response (no header) - pick the first org
          ?? data.organizations?.[0];

        if (resolvedOrg) {
          // Persist resolved org for OAuth users who don't have it set yet
          if (!orgId && resolvedOrg.id) {
            localStorage.setItem("activeOrgId", resolvedOrg.id);
          }
          if (resolvedOrg.country === null) {
            window.location.href = "/onboarding";
            return;
          }
          if (isMounted) setOrg(resolvedOrg);
        } else {
          // User has no orgs at all, redirect to onboarding
          window.location.href = "/onboarding";
          return;
        }
        startFadeOut();
      })
      .catch(() => {
        startFadeOut();
      });

    return () => {
      isMounted = false;
      if (readyTimer) window.clearTimeout(readyTimer);
    };
  }, []);

  return (
    <>
      {state !== "ready" && (
        <div
          className={`org-loader-overlay ${state === "fading" ? "org-loader-fade-out" : ""}`}
        >
          <div className="flex flex-col items-center gap-4">
            <Logo className="org-loader-logo h-10 w-auto" />
            <span className="text-sm font-medium tracking-tight text-muted-foreground/60">
              dubbl
            </span>
          </div>
        </div>
      )}
      {state === "ready" && (
        <OrganizationContext.Provider value={org}>{children}</OrganizationContext.Provider>
      )}
    </>
  );
}
