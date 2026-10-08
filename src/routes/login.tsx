import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/app/AuthLayout";
import { api, errorMessage, isDemo } from "@/lib/api";
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

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || password.length < 8) { setError("Enter your email and a password of at least 8 characters."); return; }
    setPending(true);
    try {
      const res = await api.auth.login({ email, password });
      qc.clear();
      qc.setQueryData(qk.me, res.user);
      navigate({ to: redirect ?? "/", replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    await api.auth.requestPasswordReset(email);
    toast.success(isDemo ? "Demo mode: no email is sent" : "If that account exists, a reset link is on its way.");
    setResetMode(false);
  };

  if (resetMode) {
    return (
      <AuthLayout title="Reset your password" subtitle="We'll email a single-use link that expires in 30 minutes.">
        <form onSubmit={requestReset} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <Button type="submit" className="w-full">Send reset link</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setResetMode(false)}>Back to sign in</Button>
        </form>
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
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setResetMode(true)}>Forgot password?</button>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">New here? <Link to="/register" className="font-medium text-primary hover:underline">Create an account</Link></p>
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
