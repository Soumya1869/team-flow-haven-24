import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, FolderKanban, LayoutGrid, LogOut, Menu, Plus, RotateCcw, Shield, Users } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { api, isDemo } from "@/lib/api";
import { resetDemoData } from "@/lib/api/demo";
import { roleLabel } from "@/lib/format";
import { onError, projectsQuery, qk } from "@/lib/queries";
import { DemoBadge, projectTones, UserAvatar } from "./bits";
import { useWorkspace } from "./workspace-context";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Board", icon: LayoutGrid },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/members", label: "Members", icon: Users },
  { to: "/account", label: "Account & security", icon: Shield },
] as const;

function WorkspaceSwitcher() {
  const { workspace, workspaces, setWorkspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () => api.workspaces.create({ name }),
    onSuccess: (ws) => {
      qc.invalidateQueries({ queryKey: qk.workspaces });
      setWorkspaceId(ws.id);
      setOpen(false);
      setName("");
      toast.success(`Created ${ws.name}`);
    },
    onError,
  });
  const submit = (e: FormEvent) => { e.preventDefault(); if (name.trim()) create.mutate(); };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-3 rounded-md bg-sidebar-accent px-3 py-2.5 text-left outline-none transition-colors hover:bg-sidebar-accent/80 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label={`Current workspace: ${workspace.name}. Switch workspace`}
          >
            <span className="flex size-7 items-center justify-center rounded bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {workspace.name[0]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">{workspace.name}</span>
              <span className="block text-xs text-sidebar-muted">{roleLabel[workspace.role]} · {workspace.memberCount} members</span>
            </span>
            <ChevronsUpDown className="size-4 text-sidebar-muted" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="start">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={() => setWorkspaceId(w.id)} className="gap-2">
              <span className="flex-1 truncate">{w.name}</span>
              <span className="text-xs text-muted-foreground">{roleLabel[w.role]}</span>
              {w.id === workspace.id && <Check className="size-4" aria-label="current" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpen(true)} className="gap-2">
            <Plus className="size-4" /> Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Create workspace</DialogTitle>
              <DialogDescription>You'll be the owner. Invite teammates from the Members page.</DialogDescription>
            </DialogHeader>
            <div className="my-4 space-y-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Engineering" required maxLength={80} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || !name.trim()}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, workspace } = useWorkspace();
  const projects = useQuery(projectsQuery(workspace.id));
  const qc = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    await qc.cancelQueries();
    try { await api.auth.logout(); } catch { /* still clear local state */ }
    qc.clear();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar px-4 py-5 text-sidebar-foreground">
      <div className="flex items-center justify-between px-1">
        <span className="text-lg font-semibold tracking-tight text-sidebar-accent-foreground">TeamSpace</span>
        {isDemo && <DemoBadge />}
      </div>
      <WorkspaceSwitcher />
      <nav aria-label="Main" className="space-y-0.5">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: true, includeSearch: false }}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/85 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </Link>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">Projects</p>
        <ul className="space-y-0.5">
          {projects.data?.map((p) => (
            <li key={p.id}>
              <Link
                to="/"
                search={{ project: p.id }}
                onClick={onNavigate}
                className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/80 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <span aria-hidden className={cn("size-2 rounded-sm", projectTones[p.colorIndex % 5])} />
                <span className="truncate">{p.name}</span>
              </Link>
            </li>
          ))}
          {projects.data?.length === 0 && <li className="px-3 text-sm text-sidebar-muted">No projects yet</li>}
        </ul>
      </div>
      <div className="flex items-center gap-3 border-t border-sidebar-border pt-4">
        <UserAvatar name={user.name} id={user.id} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.name}</p>
          <p className="truncate text-xs text-sidebar-muted">{user.email}</p>
        </div>
        <button onClick={signOut} aria-label="Sign out" className="rounded p-1.5 text-sidebar-muted outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

function DemoBanner() {
  const qc = useQueryClient();
  if (!isDemo) return null;
  const reset = async () => {
    resetDemoData();
    qc.clear();
    window.location.assign("/login");
  };
  return (
    <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-demo/40 px-6 py-2 text-xs text-demo-foreground">
      <DemoBadge />
      <span>Interactive demo. Data is stored in this browser only; sign-in is simulated and no real authentication or Spring Boot API is connected.</span>
      <button onClick={reset} className="ml-auto inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
        <RotateCcw className="size-3" aria-hidden /> Reset demo data
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { workspace } = useWorkspace();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block" aria-label="Sidebar">
        <SidebarContent />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
          <span className="font-semibold">TeamSpace</span>
          <span className="truncate text-sm text-muted-foreground">· {workspace.name}</span>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
