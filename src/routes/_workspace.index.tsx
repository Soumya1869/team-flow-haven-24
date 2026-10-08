import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Board } from "@/components/board/Board";
import { TaskDialog } from "@/components/board/TaskDialog";
import { EmptyState, ErrorState, projectTones } from "@/components/app/bits";
import { useWorkspace } from "@/components/app/workspace-context";
import { PRIORITIES, type TaskDto, type TaskStatus } from "@/lib/api";
import { addDaysISO, priorityLabel, todayISO } from "@/lib/format";
import { membersQuery, projectsQuery, tasksQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workspace/")({
  validateSearch: (s: Record<string, unknown>): { project?: string | undefined } => ({
    project: typeof s["project"] === "string" ? s["project"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Board — TeamSpace" },
      { name: "description", content: "Kanban board for your team's projects, tasks, assignments and deadlines." },
      { property: "og:title", content: "Board — TeamSpace" },
      { property: "og:description", content: "Kanban board for your team's projects, tasks, assignments and deadlines." },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { workspace, user } = useWorkspace();
  const ws = workspace.id;
  const { project: projectParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const projects = useQuery(projectsQuery(ws));
  const members = useQuery(membersQuery(ws));
  const project = projects.data?.find((p) => p.id === projectParam) ?? projects.data?.[0];
  const tasks = useQuery({ ...tasksQuery(ws, project?.id ?? "none"), enabled: !!project });

  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const [due, setDue] = useState("all");
  const [dialog, setDialog] = useState<{ open: boolean; task: TaskDto | null; status: TaskStatus }>({ open: false, task: null, status: "TODO" });

  const today = todayISO();
  const weekEnd = addDaysISO(7);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (tasks.data ?? []).filter((t) =>
      (!term || t.title.toLowerCase().includes(term) || t.key.toLowerCase().includes(term) || t.description.toLowerCase().includes(term)) &&
      (assignee === "all" || (assignee === "me" ? t.assigneeId === user.id : assignee === "none" ? !t.assigneeId : t.assigneeId === assignee)) &&
      (priority === "all" || t.priority === priority) &&
      (due === "all" ||
        (due === "overdue" && !!t.dueDate && t.dueDate < today && t.status !== "DONE") ||
        (due === "week" && !!t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd)),
    );
  }, [tasks.data, q, assignee, priority, due, user.id, today, weekEnd]);
  const filtering = q || assignee !== "all" || priority !== "all" || due !== "all";

  const all = tasks.data ?? [];
  const open = all.filter((t) => t.status !== "DONE");
  const stats = [
    { label: "Open tasks", value: open.length },
    { label: "Assigned to you", value: open.filter((t) => t.assigneeId === user.id).length },
    { label: "Due this week", value: open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd).length },
    { label: "Overdue", value: open.filter((t) => t.dueDate && t.dueDate < today).length, alert: true },
    { label: "Complete", value: all.length ? `${Math.round(((all.length - open.length) / all.length) * 100)}%` : "—" },
  ];

  if (projects.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-24 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (projects.isError) return <ErrorState error={projects.error} onRetry={() => projects.refetch()} />;
  if (!project) {
    return (
      <EmptyState
        icon={<FolderKanban className="size-6" aria-hidden />}
        title="No projects in this workspace"
        description="Create a project to start planning work on a board."
        action={<Button asChild><Link to="/projects">Go to projects</Link></Button>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span aria-hidden className={cn("size-3 rounded", projectTones[project.colorIndex % 5])} />
        <div className="min-w-0">
          <Label htmlFor="project-picker" className="sr-only">Project</Label>
          <Select value={project.id} onValueChange={(id) => navigate({ search: { project: id } })}>
            <SelectTrigger id="project-picker" className="h-auto border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight shadow-none focus:ring-0 [&>svg]:ml-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{projects.data!.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <p className="mt-0.5 text-sm text-muted-foreground">{project.description || `${workspace.name} · ${project.key}`}</p>
        </div>
        <Button className="ml-auto" onClick={() => setDialog({ open: true, task: null, status: "TODO" })}>
          <Plus className="size-4" /> New task
        </Button>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className={cn("mt-1 text-xl font-semibold tabular-nums", s.alert && Number(s.value) > 0 && "text-destructive")}>
              {tasks.isLoading ? "…" : s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mb-5 flex flex-wrap items-center gap-2" role="search" aria-label="Filter tasks">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Label htmlFor="task-search" className="sr-only">Search tasks</Label>
          <Input id="task-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or keys" className="bg-card pl-8" />
        </div>
        <FilterSelect label="Assignee" value={assignee} onChange={setAssignee} options={[
          ["all", "All assignees"], ["me", "Assigned to me"], ["none", "Unassigned"],
          ...(members.data ?? []).map((m) => [m.userId, m.name] as [string, string]),
        ]} />
        <FilterSelect label="Priority" value={priority} onChange={setPriority} options={[["all", "All priorities"], ...PRIORITIES.map((p) => [p, priorityLabel[p]] as [string, string])]} />
        <FilterSelect label="Due" value={due} onChange={setDue} options={[["all", "Any due date"], ["week", "Due this week"], ["overdue", "Overdue"]]} />
        {filtering && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setAssignee("all"); setPriority("all"); setDue("all"); }}>
            <X className="size-4" /> Clear
          </Button>
        )}
        <p className="ml-auto hidden text-xs text-muted-foreground xl:block">
          Tip: focus a card, press <kbd className="rounded border bg-card px-1 font-mono">Shift</kbd>+<kbd className="rounded border bg-card px-1 font-mono">←/→</kbd> to move it.
        </p>
      </div>

      {tasks.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80" />)}</div>
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : filtering && filtered.length === 0 ? (
        <EmptyState title="No tasks match these filters" description="Try a different search or clear the filters." />
      ) : (
        <Board ws={ws} projectId={project.id} tasks={filtered} members={members.data ?? []}
          onOpen={(t) => setDialog({ open: true, task: t, status: t.status })}
          onCreate={(s) => setDialog({ open: true, task: null, status: s })} />
      )}

      <TaskDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        projectId={project.id} task={dialog.task} defaultStatus={dialog.status} members={members.data ?? []} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`} className="w-auto min-w-36 bg-card"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
