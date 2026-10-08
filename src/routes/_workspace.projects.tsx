import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, projectTones } from "@/components/app/bits";
import { useWorkspace } from "@/components/app/workspace-context";
import { api } from "@/lib/api";
import { canManageProjects } from "@/lib/permissions";
import { onError, projectsQuery, qk } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workspace/projects")({
  head: () => ({
    meta: [
      { title: "Projects — TeamSpace" },
      { name: "description", content: "All projects in your TeamSpace workspace with progress at a glance." },
      { property: "og:title", content: "Projects — TeamSpace" },
      { property: "og:description", content: "All projects in your TeamSpace workspace with progress at a glance." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const qc = useQueryClient();
  const projects = useQuery(projectsQuery(ws));
  const manage = canManageProjects(workspace.role);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", key: "", description: "" });

  const create = useMutation({
    mutationFn: () => api.projects.create(ws, form),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: qk.projects(ws) }); setOpen(false); setForm({ name: "", key: "", description: "" }); toast.success(`Created ${p.name}`); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.projects.remove(ws, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.projects(ws) }); toast.success("Project deleted"); },
    onError,
  });
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Projects"
        description={`${workspace.name} · ${projects.data?.length ?? 0} projects`}
        actions={manage ? <Button onClick={() => setOpen(true)}><Plus className="size-4" /> New project</Button>
          : <span className="text-sm text-muted-foreground">Only owners and admins can create projects.</span>}
      />
      {projects.isLoading ? <ListSkeleton /> : projects.isError ? <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
        : projects.data!.length === 0 ? <EmptyState title="No projects yet" description="Projects group related tasks on a board." />
        : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data!.map((p) => {
              const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
              return (
                <li key={p.id} className="flex flex-col rounded-lg border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className={cn("mt-1.5 size-2.5 rounded-sm", projectTones[p.colorIndex % 5])} />
                    <div className="min-w-0 flex-1">
                      <Link to="/" search={{ project: p.id }} className="font-semibold hover:underline">{p.name}</Link>
                      <p className="font-mono text-xs text-muted-foreground">{p.key}</p>
                    </div>
                    {manage && (
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`Delete ${p.name}`}
                        onClick={() => { if (confirm(`Delete ${p.name} and all its tasks?`)) remove.mutate(p.id); }}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description || "No description"}</p>
                  <div className="mt-5">
                    <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>{p.doneCount}/{p.taskCount} done</span><span>{pct}%</span>
                    </div>
                    <Progress value={pct} aria-label={`${p.name} progress`} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader><DialogTitle>New project</DialogTitle><DialogDescription>The key prefixes task IDs, e.g. WEB-12.</DialogDescription></DialogHeader>
            <div className="my-4 grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1.5"><Label htmlFor="p-name">Name</Label><Input id="p-name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="p-key">Key</Label><Input id="p-key" required pattern="[A-Za-z][A-Za-z0-9]{1,5}" maxLength={6} className="font-mono uppercase" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" rows={3} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>Create project</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
