import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { ErrorState, ListSkeleton } from "@/components/app/bits";
import { ACTIVE_WS_KEY, WorkspaceContext } from "@/components/app/workspace-context";
import { isApiError } from "@/lib/api";
import { meQuery, workspacesQuery } from "@/lib/queries";

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
      return <div className="p-10"><ErrorState error={new Error("You're not a member of any workspace yet. Ask an owner to invite you.")} /></div>;
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
