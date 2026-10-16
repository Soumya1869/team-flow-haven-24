import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Laptop, MailWarning } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState, ListSkeleton, PageHeader } from "@/components/app/bits";
import { useWorkspace } from "@/components/app/workspace-context";
import { api, isDemo, emailEnabled } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { onError, qk, sessionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_workspace/account")({
  head: () => ({
    meta: [
      { title: "Account & security â€” TeamSpace" },
      { name: "description", content: "Profile, password, email verification and active sessions for your TeamSpace account." },
      { property: "og:title", content: "Account & security â€” TeamSpace" },
      { property: "og:description", content: "Profile, password, email verification and active sessions for your TeamSpace account." },
    ],
  }),
  component: AccountPage,
});

const card = "rounded-lg border bg-card p-6";

function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account & security" description="Manage your profile, password and signed-in devices." />
      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Password</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><Profile /></TabsContent>
        <TabsContent value="security"><Password /></TabsContent>
        <TabsContent value="sessions"><Sessions /></TabsContent>
      </Tabs>
    </div>
  );
}

function Profile() {
  const { user } = useWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [verificationCode, setVerificationCode] = useState("");
  const verify = useMutation({ mutationFn: () => api.auth.confirmEmail(verificationCode.trim()), onSuccess: () => { setVerificationCode(""); qc.invalidateQueries({ queryKey: qk.me }); toast.success("Email verified"); }, onError });
  const save = useMutation({ mutationFn: () => api.auth.updateProfile({ name }), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.me }); toast.success("Profile saved"); }, onError });
  const resend = useMutation({ mutationFn: () => api.auth.resendVerification(), onSuccess: () => toast.success(isDemo ? "Demo mode: no email is actually sent" : "Verification email sent"), onError });
  return (
    <div className="space-y-6">
      <form className={card} onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="acc-name">Full name</Label><Input id="acc-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="acc-email">Email</Label><Input id="acc-email" value={user.email} readOnly aria-readonly className="bg-muted" /></div>
        </div>
        <Button type="submit" className="mt-5" disabled={save.isPending}>Save profile</Button>
      </form>
      <div className={`${card} flex flex-wrap items-center gap-4`}>
        {user.emailVerified ? <BadgeCheck className="size-5 text-success" aria-hidden /> : <MailWarning className="size-5 text-warning" aria-hidden />}
        <div className="flex-1">
          <p className="font-medium">{user.emailVerified ? "Email verified" : "Email not verified"}</p>
          <p className="text-sm text-muted-foreground">{!emailEnabled ? "Email is used only to sign in. Verification and email recovery are unavailable." : isDemo ? "Simulated email status; no email is sent in demo mode." : user.emailVerified ? "Your email address has been confirmed." : "Enter the code sent to your email to confirm this address."}</p>
        </div>
        {emailEnabled && !user.emailVerified && <Button variant="outline" onClick={() => resend.mutate()} disabled={resend.isPending}>Resend verification</Button>}
      </div>
      {emailEnabled && !isDemo && !user.emailVerified && <form className={card} onSubmit={(e) => { e.preventDefault(); verify.mutate(); }}>
        <Label htmlFor="verify-code">Verification code</Label>
        <Input id="verify-code" className="mt-2" required autoComplete="off" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
        <Button type="submit" className="mt-4" disabled={verify.isPending}>Verify email</Button>
      </form>}
    </div>
  );
}

function Password() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () => api.auth.changePassword({ currentPassword: form.current, newPassword: form.next }),
    onSuccess: () => { setForm({ current: "", next: "", confirm: "" }); toast.success(isDemo ? "Demo mode: validated, but no password is stored" : "Password changed. Other sessions were signed out."); },
    onError,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.next.length < 12) return setError("New password must be at least 12 characters");
    if (form.next !== form.confirm) return setError("Passwords don't match");
    setError(null);
    change.mutate();
  };
  return (
    <form className={card} onSubmit={submit} noValidate>
      <div className="grid max-w-md gap-4">
        <div className="space-y-1.5"><Label htmlFor="pw-cur">Current password</Label><Input id="pw-cur" type="password" autoComplete="current-password" required value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="pw-new">New password</Label><Input id="pw-new" type="password" autoComplete="new-password" required aria-describedby="pw-hint" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} /><p id="pw-hint" className="text-xs text-muted-foreground">At least 12 characters.</p></div>
        <div className="space-y-1.5"><Label htmlFor="pw-conf">Confirm new password</Label><Input id="pw-conf" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <Button type="submit" className="mt-5" disabled={change.isPending}>Change password</Button>
    </form>
  );
}

function Sessions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sessions = useQuery(sessionsQuery);
  const revoke = useMutation({
    mutationFn: (s: { id: string; current: boolean }) => api.sessions.revoke(s.id).then(() => s.current),
    onSuccess: async (wasCurrent) => {
      if (wasCurrent) { await qc.cancelQueries(); qc.clear(); navigate({ to: "/login", replace: true }); return; }
      qc.invalidateQueries({ queryKey: qk.sessions }); toast.success("Session revoked");
    },
    onError,
  });
  const others = useMutation({ mutationFn: () => api.sessions.revokeOthers(), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.sessions }); toast.success("Signed out of other devices"); }, onError });

  if (sessions.isLoading) return <ListSkeleton rows={2} />;
  if (sessions.isError) return <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />;
  return (
    <div className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Each session is a refresh token. Revoking one signs that device out.</p>
        <Button variant="outline" size="sm" onClick={() => others.mutate()} disabled={others.isPending || sessions.data!.length < 2}>Sign out other devices</Button>
      </div>
      <ul className="divide-y">
        {sessions.data!.map((s) => (
          <li key={s.id} className="flex items-center gap-4 py-3">
            <Laptop className="size-5 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.userAgent}{s.current && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground">This device</span>}</p>
              <p className="text-xs text-muted-foreground">{s.ipAddress} Â· last active {formatDateTime(s.lastUsedAt)}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => revoke.mutate(s)}>{s.current ? "Sign out" : "Revoke"}</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
