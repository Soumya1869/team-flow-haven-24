import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, type MoveTaskRequest, type TaskDto } from "./api";

export const qk = {
  me: ["me"] as const,
  workspaces: ["workspaces"] as const,
  sessions: ["sessions"] as const,
  members: (ws: string) => ["members", ws] as const,
  projects: (ws: string) => ["projects", ws] as const,
  tasks: (ws: string, p: string) => ["tasks", ws, p] as const,
  comments: (ws: string, t: string) => ["comments", ws, t] as const,
};

export const meQuery = queryOptions({ queryKey: qk.me, queryFn: () => api.auth.me(), retry: false, staleTime: 60_000 });
export const workspacesQuery = queryOptions({ queryKey: qk.workspaces, queryFn: () => api.workspaces.list() });
export const sessionsQuery = queryOptions({ queryKey: qk.sessions, queryFn: () => api.sessions.list() });
export const membersQuery = (ws: string) => queryOptions({ queryKey: qk.members(ws), queryFn: () => api.members.list(ws) });
export const projectsQuery = (ws: string) => queryOptions({ queryKey: qk.projects(ws), queryFn: () => api.projects.list(ws) });
export const tasksQuery = (ws: string, p: string) => queryOptions({ queryKey: qk.tasks(ws, p), queryFn: () => api.tasks.list(ws, p) });
export const commentsQuery = (ws: string, t: string) => queryOptions({ queryKey: qk.comments(ws, t), queryFn: () => api.comments.list(ws, t) });

export const onError = (e: unknown) => toast.error(errorMessage(e));

/** Optimistic status move so drag-and-drop and keyboard moves feel instant. */
export function useMoveTask(ws: string, projectId: string) {
  const qc = useQueryClient();
  const key = qk.tasks(ws, projectId);
  return useMutation({
    mutationFn: ({ id, ...body }: MoveTaskRequest & { id: string }) => api.tasks.move(ws, id, body),
    onMutate: async ({ id, status, position }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskDto[]>(key);
      qc.setQueryData<TaskDto[]>(key, (old) => old?.map((t) => (t.id === id ? { ...t, status, position } : t)));
      return { prev };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); onError(e); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: qk.projects(ws) });
    },
  });
}
