import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { ErrorState, ListSkeleton } from "@/components/app/bits";
import { ACTIVE_WS_KEY, WorkspaceContext } from "@/components/app/workspace-context";
import { api, isApiError } from "@/lib/api";
import { meQuery, workspacesQuery, qk, onError } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Client-only: demo data lives in browser storage, and real mode holds the access token in memory.
export const Route = createFileRoute("/_workspace")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery);
    } catch (e) {
      if (isApiError(e) && e.status === 401) throw redirect({ to: "/login", search: { redirect: location.href } });
      throw e;
    }
  },
  pendingComponent: () => <div className="p-10"><ListSkeleton rows={6} /></div>,
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const me = useQuery(meQuery);
  const workspaces = useQuery(workspacesQuery);
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_WS_KEY));
  useEffect(() => { if (activeId) localStorage.setItem(ACTIVE_WS_KEY, activeId); }, [activeId]);

  const workspace = workspaces.data?.find((w) => w.id === activeId) ?? workspaces.data?.[0];
  const value = useMemo(
    () => me.data && workspace && workspaces.data
      ? { user: me.data, workspace, workspaces: workspaces.data, setWorkspaceId: setActiveId }
      : null,
    [me.data, workspace, workspaces.data],
  );

  if (workspaces.isError) return <div className="p-10"><ErrorState error={workspaces.error} onRetry={() => workspaces.refetch()} /></div>;
  if (!value) {
    if (workspaces.data?.length === 0) {
      return <FirstWorkspace />;
    }
    return <div className="p-10"><ListSkeleton rows={6} /></div>;
  }
  return (
    <WorkspaceContext.Provider value={value}>
      <AppShell>
        <Outlet />
      </AppShell>
    </WorkspaceContext.Provider>
  );
}

function FirstWorkspace() {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () => api.workspaces.create({ name: name.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workspaces }),
    onError,
  });
  return <main className="mx-auto max-w-md px-6 py-20">
    <h1 className="text-2xl font-semibold">Create your first workspace</h1>
    <p className="mt-2 text-sm text-muted-foreground">Give your team a place to organize projects and tasks. You will be its owner.</p>
    <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
      <Label htmlFor="first-workspace">Workspace name</Label>
      <Input id="first-workspace" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" disabled={create.isPending || !name.trim()}>{create.isPending ? "Creating…" : "Create workspace"}</Button>
    </form>
  </main>;
}
