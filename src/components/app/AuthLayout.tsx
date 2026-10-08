import type { ReactNode } from "react";
import { isDemo } from "@/lib/api";
import { DemoBadge } from "./bits";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <span className="text-xl font-semibold text-sidebar-accent-foreground">TeamSpace</span>
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight text-sidebar-accent-foreground">Plan the work. Ship the work. Keep every workspace separate.</p>
          <p className="mt-4 text-sm text-sidebar-muted">Workspaces, projects and Kanban boards with owner, admin and member roles per workspace.</p>
        </div>
        <p className="text-xs text-sidebar-muted">Frontend for a Spring Boot + PostgreSQL API.</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {isDemo && <DemoBadge className="mb-6" />}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 mb-8 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
