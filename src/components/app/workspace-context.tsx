import { createContext, useContext } from "react";
import type { UserDto, WorkspaceDto } from "@/lib/api";

export interface WorkspaceCtx {
  user: UserDto;
  workspace: WorkspaceDto;
  workspaces: WorkspaceDto[];
  setWorkspaceId: (id: string) => void;
}

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside the workspace layout");
  return ctx;
}

export const ACTIVE_WS_KEY = "teamspace.ui.activeWorkspace"; // UI preference only, not a credential
