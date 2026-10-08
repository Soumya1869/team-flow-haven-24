import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, ListSkeleton, PageHeader, UserAvatar } from "@/components/app/bits";
import { useWorkspace } from "@/components/app/workspace-context";
import { api, ROLES, type Role } from "@/lib/api";
import { roleLabel } from "@/lib/format";
import { canAssignRole, canManageMembers, canRemoveMember } from "@/lib/permissions";
import { membersQuery, onError, qk } from "@/lib/queries";

export const Route = createFileRoute("/_workspace/members")({
  head: () => ({
    meta: [
      { title: "Members — TeamSpace" },
      { name: "description", content: "Manage workspace members and their owner, admin or member roles." },
      { property: "og:title", content: "Members — TeamSpace" },
      { property: "og:description", content: "Manage workspace members and their owner, admin or member roles." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { workspace, workspaces, user } = useWorkspace();
  const ws = workspace.id;
  const qc = useQueryClient();
  const members = useQuery(membersQuery(ws));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const refresh = () => { qc.invalidateQueries({ queryKey: qk.members(ws) }); qc.invalidateQueries({ queryKey: qk.workspaces }); };

  const add = useMutation({ mutationFn: () => api.members.add(ws, { email, role }), onSuccess: (m) => { refresh(); setEmail(""); toast.success(`${m.name} added`); }, onError });
  const update = useMutation({ mutationFn: (v: { userId: string; role: Role }) => api.members.updateRole(ws, v.userId, { role: v.role }), onSuccess: () => { refresh(); toast.success("Role updated"); }, onError });
  const remove = useMutation({ mutationFn: (userId: string) => api.members.remove(ws, userId), onSuccess: () => { refresh(); toast.success("Member removed"); }, onError });

  const manage = canManageMembers(workspace.role);
  const assignable = ROLES.filter((r) => canAssignRole(workspace.role, null, r));
  const submit = (e: FormEvent) => { e.preventDefault(); add.mutate(); };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Members" description={`People in ${workspace.name}. You are ${roleLabel[workspace.role].toLowerCase() === "admin" ? "an admin" : `a${workspace.role === "OWNER" ? "n" : ""} ${roleLabel[workspace.role].toLowerCase()}`} here.`} />

      {manage ? (
        <form onSubmit={submit} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-60 flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Add by email</Label>
            <Input id="invite-email" type="email" required placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="invite-role" className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{assignable.map((r) => <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={add.isPending}><UserPlus className="size-4" /> Add member</Button>
        </form>
      ) : (
        <p className="mb-6 rounded-lg border bg-card p-4 text-sm text-muted-foreground">Only owners and admins can add members or change roles.</p>
      )}

      {members.isLoading ? <ListSkeleton /> : members.isError ? <ErrorState error={members.error} onRetry={() => members.refetch()} /> : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Workspace members</caption>
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th scope="col" className="px-4 py-2.5 font-medium">Name</th><th scope="col" className="px-4 py-2.5 font-medium">Role</th><th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Joined</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {members.data!.map((m) => {
                const self = m.userId === user.id;
                const roleOptions = ROLES.filter((r) => r === m.role || canAssignRole(workspace.role, m.role, r));
                return (
                  <tr key={m.userId} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={m.name} id={m.userId} />
                        <div className="min-w-0"><p className="font-medium">{m.name}{self && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}</p><p className="truncate text-xs text-muted-foreground">{m.email}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {roleOptions.length > 1 ? (
                        <Select value={m.role} onValueChange={(r) => update.mutate({ userId: m.userId, role: r as Role })}>
                          <SelectTrigger aria-label={`Role for ${m.name}`} className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>{roleOptions.map((r) => <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <span>{roleLabel[m.role]}</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{new Date(m.joinedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {canRemoveMember(workspace.role, m.role, self) && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(self ? "Leave this workspace?" : `Remove ${m.name}?`)) remove.mutate(m.userId); }}>
                          {self ? "Leave" : "Remove"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-10" aria-labelledby="my-roles">
        <h2 id="my-roles" className="mb-3 text-sm font-semibold">Your roles across workspaces</h2>
        <ul className="flex flex-wrap gap-2">
          {workspaces.map((w) => (
            <li key={w.id} className="rounded-full border bg-card px-3 py-1 text-xs">{w.name} · <span className="font-medium">{roleLabel[w.role]}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
