import type { Priority, Role, TaskStatus } from "./types";

// Demo-only data model. Contains NO passwords or tokens.
export interface DemoUser { id: string; name: string; email: string; emailVerified: boolean; createdAt: string }
export interface DemoWorkspace { id: string; name: string; slug: string; createdAt: string }
export interface DemoMembership { workspaceId: string; userId: string; role: Role; joinedAt: string }
export interface DemoProject { id: string; workspaceId: string; key: string; name: string; description: string; colorIndex: number; createdAt: string; seq: number }
export interface DemoTask {
  id: string; workspaceId: string; projectId: string; key: string; title: string; description: string;
  status: TaskStatus; priority: Priority; assigneeId: string | null; createdById: string;
  dueDate: string | null; position: number; createdAt: string; updatedAt: string;
}
export interface DemoComment { id: string; workspaceId: string; taskId: string; authorId: string; body: string; createdAt: string }
export interface DemoSession { id: string; userId: string; userAgent: string; ipAddress: string; createdAt: string; lastUsedAt: string }
export interface DemoDb {
  version: 1;
  users: DemoUser[];
  workspaces: DemoWorkspace[];
  memberships: DemoMembership[];
  projects: DemoProject[];
  tasks: DemoTask[];
  comments: DemoComment[];
  sessions: DemoSession[];
  currentUserId: string | null;
  currentSessionId: string | null;
}

const day = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const date = (offsetDays: number) => iso(offsetDays).slice(0, 10);

type T = [title: string, status: TaskStatus, priority: Priority, assignee: string | null, due: number | null, desc?: string];

export function createSeed(): DemoDb {
  const users: DemoUser[] = [
    ["u-priya", "Priya Raman", "priya@northwind.dev"],
    ["u-marcus", "Marcus Chen", "marcus@northwind.dev"],
    ["u-elena", "Elena Novak", "elena@northwind.dev"],
    ["u-daniel", "Daniel Okafor", "daniel@northwind.dev"],
    ["u-sofia", "Sofia Alvarez", "sofia@harborhealth.org"],
    ["u-hannah", "Hannah Weiss", "hannah@harborhealth.org"],
    ["u-tom", "Tom Becker", "tom@fieldnote.studio"],
  ].map(([id, name, email], i) => ({ id: id!, name: name!, email: email!, i })).map(({ id, name, email, i }) => ({ id, name, email, emailVerified: i !== 3, createdAt: iso(-200 + i * 10) }));

  const workspaces: DemoWorkspace[] = [
    { id: "ws-northwind", name: "Northwind Labs", slug: "northwind", createdAt: iso(-180) },
    { id: "ws-harbor", name: "Harbor Health Collective", slug: "harbor-health", createdAt: iso(-120) },
    { id: "ws-fieldnote", name: "Fieldnote Studio", slug: "fieldnote", createdAt: iso(-90) },
  ];

  const m = (workspaceId: string, userId: string, role: Role, d: number): DemoMembership => ({ workspaceId, userId, role, joinedAt: iso(d) });
  const memberships = [
    m("ws-northwind", "u-priya", "OWNER", -180),
    m("ws-northwind", "u-marcus", "ADMIN", -170),
    m("ws-northwind", "u-elena", "MEMBER", -150),
    m("ws-northwind", "u-daniel", "MEMBER", -60),
    m("ws-harbor", "u-sofia", "OWNER", -120),
    m("ws-harbor", "u-hannah", "ADMIN", -110),
    m("ws-harbor", "u-priya", "MEMBER", -100),
    m("ws-fieldnote", "u-tom", "OWNER", -90),
    m("ws-fieldnote", "u-priya", "ADMIN", -85),
    m("ws-fieldnote", "u-elena", "MEMBER", -40),
  ];

  const projects: DemoProject[] = [];
  const tasks: DemoTask[] = [];
  const comments: DemoComment[] = [];

  const addProject = (id: string, workspaceId: string, key: string, name: string, description: string, colorIndex: number, list: T[]) => {
    const p: DemoProject = { id, workspaceId, key, name, description, colorIndex, createdAt: iso(-80), seq: 0 };
    projects.push(p);
    const owner = memberships.find((x) => x.workspaceId === workspaceId && x.role === "OWNER")!.userId;
    list.forEach(([title, status, priority, assigneeId, due, desc], i) => {
      p.seq += 1;
      tasks.push({
        id: `${id}-t${p.seq}`, workspaceId, projectId: id, key: `${key}-${p.seq}`, title, description: desc ?? "",
        status, priority, assigneeId, createdById: owner, dueDate: due === null ? null : date(due),
        position: i, createdAt: iso(-30 + i), updatedAt: iso(-5 + (i % 4)),
      });
    });
  };

  addProject("p-portal", "ws-northwind", "CP", "Customer Portal", "Self-service portal for invoices, usage and support tickets.", 0, [
    ["Design account settings layout", "DONE", "MEDIUM", "u-elena", -6, "Settings split into Profile, Billing and Notifications tabs."],
    ["Implement invoice PDF download", "IN_PROGRESS", "HIGH", "u-marcus", 3, "Stream PDFs from the billing service; cache for 10 minutes."],
    ["Add rate limiting to support ticket API", "TODO", "URGENT", "u-daniel", 1, "Abuse reports from two tenants last week."],
    ["Usage chart: switch to daily granularity", "IN_REVIEW", "MEDIUM", "u-elena", 2],
    ["Audit accessibility of the ticket form", "TODO", "MEDIUM", null, 9, "Run axe + manual screen reader pass."],
    ["SSO login for enterprise tenants", "TODO", "HIGH", "u-priya", 14, "SAML first; OIDC follow-up."],
    ["Fix timezone bug on usage export", "IN_PROGRESS", "HIGH", "u-daniel", -1, "Exports use server TZ instead of tenant TZ."],
    ["Write onboarding empty states", "DONE", "LOW", "u-elena", -12],
    ["Paginate ticket history", "IN_REVIEW", "LOW", "u-marcus", 5],
    ["Notification preferences endpoint", "TODO", "MEDIUM", "u-marcus", null],
  ]);
  addProject("p-billing", "ws-northwind", "BIL", "Billing Migration", "Move subscriptions from the legacy system to the new ledger.", 1, [
    ["Map legacy plan codes to new catalog", "DONE", "HIGH", "u-priya", -10],
    ["Dry-run migration on staging snapshot", "IN_PROGRESS", "URGENT", "u-marcus", 2],
    ["Reconcile proration differences", "TODO", "HIGH", "u-daniel", 6],
    ["Customer email for billing date change", "TODO", "MEDIUM", "u-elena", 10],
    ["Rollback runbook", "IN_REVIEW", "HIGH", "u-priya", 4],
  ]);
  addProject("p-mobile", "ws-northwind", "MOB", "Mobile App v2", "Rebuild of the field technician app.", 2, [
    ["Offline sync conflict strategy", "TODO", "HIGH", "u-marcus", 20],
    ["Push notification permissions flow", "TODO", "LOW", null, null],
  ]);
  addProject("p-intake", "ws-harbor", "PAT", "Patient Intake", "Digital intake forms for partner clinics.", 3, [
    ["Consent form e-signature", "IN_PROGRESS", "URGENT", "u-hannah", 2],
    ["Translate forms into Spanish", "TODO", "MEDIUM", "u-priya", 8],
    ["Clinic admin dashboard filters", "IN_REVIEW", "MEDIUM", "u-sofia", 3],
    ["Retention policy for uploaded IDs", "TODO", "HIGH", "u-sofia", 12],
  ]);
  addProject("p-brand", "ws-fieldnote", "BRD", "Brand Site Refresh", "New marketing site and case study templates.", 4, [
    ["Case study template", "IN_PROGRESS", "MEDIUM", "u-elena", 4],
    ["Image pipeline with AVIF", "TODO", "LOW", "u-priya", 15],
    ["Copy review with client", "DONE", "MEDIUM", "u-tom", -3],
  ]);

  const c = (taskId: string, authorId: string, body: string, d: number) => {
    const t = tasks.find((x) => x.id === taskId)!;
    comments.push({ id: `c-${comments.length + 1}`, workspaceId: t.workspaceId, taskId, authorId, body, createdAt: iso(d) });
  };
  c("p-portal-t2", "u-priya", "Can we reuse the signed URL helper from the reports module?", -2);
  c("p-portal-t2", "u-marcus", "Yes — wired it up, only the cache headers are left.", -1);
  c("p-portal-t3", "u-marcus", "Suggest 60 req/min per tenant with a burst of 20.", -1);
  c("p-portal-t7", "u-elena", "Reproduced with an Auckland tenant. Off by one day.", -2);
  c("p-billing-t2", "u-priya", "Snapshot from Monday is ready on staging-db-2.", -1);
  c("p-intake-t1", "u-sofia", "Legal approved the signature vendor.", -3);

  const sessions: DemoSession[] = [
    { id: "s-laptop", userId: "u-priya", userAgent: "Firefox 131 on macOS", ipAddress: "203.0.113.24", createdAt: iso(-12), lastUsedAt: iso(-0.2) },
    { id: "s-phone", userId: "u-priya", userAgent: "Safari on iOS 18", ipAddress: "198.51.100.7", createdAt: iso(-30), lastUsedAt: iso(-2) },
  ];

  return { version: 1, users, workspaces, memberships, projects, tasks, comments, sessions, currentUserId: null, currentSessionId: null };
}
