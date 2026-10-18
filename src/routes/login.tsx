import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/app/AuthLayout";
import { api, errorMessage, isDemo, emailEnabled } from "@/lib/api";
import { qk } from "@/lib/queries";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => {
    const r = s["redirect"];
    // only same-origin relative paths, to prevent open redirects
    return { redirect: typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : undefined };
  },
  head: () => ({
    meta: [
      { title: "Sign in — TeamSpace" },
      { name: "description", content: "Sign in to TeamSpace to manage your team's projects and tasks." },
      { property: "og:title", content: "Sign in — TeamSpace" },
      { property: "og:description", content: "Sign in to TeamSpace to manage your team's projects and tasks." },
    ],
  }),
  component: LoginPage,
});

const demoAccounts = [
  { email: "priya@northwind.dev", note: "Owner · Admin · Member in 3 workspaces" },
  { email: "elena@northwind.dev", note: "Member in 2 workspaces" },
  { email: "sofia@harborhealth.org", note: "Owner of Harbor Health" },
];

// Intentionally public credentials for the shared portfolio demo only.
const publicTesters = [
  { role: "Owner", email: "owner.578fa5@example.com", password: "_QpMTMLCaqsvqladJR2s", note: "Manage all roles, members, projects, and tasks." },
  { role: "Admin", email: "admin.578fa5@example.com", password: "2anJC9TYiT8GxkTR-YIG", note: "Manage projects and regular members." },
  { role: "Member", email: "member.578fa5@example.com", password: "pkZZSRbgj3AL-Qa1gybY", note: "Create tasks, move cards, assign work, and comment." },
];

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await signIn(email, password);
  };

  const signIn = async (email: string, password: string, demo = false) => {
    setError(null);
    if (!email || password.length < 8) { setError("Enter your email and a password of at least 8 characters."); return; }
    setPending(true);
    try {
      const res = await api.auth.login({ email, password });
      qc.clear();
      qc.setQueryData(qk.me, res.user);
      navigate({ to: demo ? "/" : redirect ?? "/", replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true); setError(null);
    try {
      await api.auth.requestPasswordReset(email);
      toast.success(isDemo ? "Demo mode: no email is sent" : "If that account exists, a reset code is on its way.");
    } catch (err) { setError(errorMessage(err)); }
    finally { setPending(false); }
  };

  const confirmReset = async (e: FormEvent) => {
    e.preventDefault(); setPending(true); setError(null);
    try {
      await api.auth.confirmPasswordReset(resetCode.trim(), newPassword);
      setResetCode(""); setNewPassword(""); setPassword(""); setResetMode(false);
      toast.success("Password reset. Sign in with your new password.");
    } catch (err) { setError(errorMessage(err)); }
    finally { setPending(false); }
  };

  if (emailEnabled && resetMode) {
    return (
      <AuthLayout title="Reset your password" subtitle="We'll email a single-use code that expires in 30 minutes.">
        <form onSubmit={requestReset} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <Button type="submit" className="w-full" disabled={pending}>Send reset code</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setResetMode(false)}>Back to sign in</Button>
        </form>
        {!isDemo && <form onSubmit={confirmReset} className="mt-6 space-y-4 border-t pt-6">
          <div className="space-y-1.5"><Label htmlFor="reset-code">Code from email</Label><Input id="reset-code" required value={resetCode} onChange={(e) => setResetCode(e.target.value)} autoComplete="off" /></div>
          <div className="space-y-1.5"><Label htmlFor="reset-password">New password</Label><Input id="reset-password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={pending}>Set new password</Button>
        </form>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back to TeamSpace.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {emailEnabled && <button type="button" className="text-xs text-primary hover:underline" onClick={() => setResetMode(true)}>Forgot password?</button>}
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      </form>
      {!emailEnabled && <p className="mt-4 text-sm text-muted-foreground">Password recovery is unavailable. Keep your password safe; you can change it while signed in.</p>}
      <p className="mt-6 text-center text-sm text-muted-foreground">New here? <Link to="/register" className="font-medium text-primary hover:underline">Create an account</Link></p>
      {!isDemo && (
        <section aria-labelledby="try-demo" className="mt-6 rounded-lg border bg-card p-4">
          <h2 id="try-demo" className="font-semibold">Try a demo account</h2>
          <p className="mt-1 text-xs text-muted-foreground">Explore Role Testing Playground with sample tasks. These accounts and changes are shared with everyone. Please keep the credentials and roles unchanged, and use sample data only.</p>
          <div className="mt-4 space-y-3">
            {publicTesters.map((account) => (
              <div key={account.role} className="rounded-md border p-3">
                <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => { setEmail(account.email); setPassword(account.password); void signIn(account.email, account.password, true); }}>Try as {account.role}</Button>
                <p className="mt-2 text-xs text-muted-foreground">{account.note}</p>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">View login credentials</summary>
                  <p className="mt-2 break-all">Email: <code>{account.email}</code></p>
                  <p className="mt-1 break-all">Password: <code>{account.password}</code></p>
                </details>
              </div>
            ))}
          </div>
        </section>
      )}
      {isDemo && (
        <div className="mt-8 rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demo accounts</p>
          <p className="mt-1 text-xs text-muted-foreground">Sign-in is simulated: any password of 8+ characters works, and nothing is verified or stored.</p>
          <ul className="mt-3 space-y-1">
            {demoAccounts.map((a) => (
              <li key={a.email}>
                <button type="button" onClick={() => { setEmail(a.email); setPassword("demo-password"); }} className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted">
                  <span className="font-medium">{a.email}</span><span className="block text-xs text-muted-foreground">{a.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AuthLayout>
  );
}

