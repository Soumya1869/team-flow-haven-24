import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/app/AuthLayout";
import { api, errorMessage } from "@/lib/api";
import { qk } from "@/lib/queries";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — TeamSpace" },
      { name: "description", content: "Create a TeamSpace account and your first workspace." },
      { property: "og:title", content: "Create account — TeamSpace" },
      { property: "og:description", content: "Create a TeamSpace account and your first workspace." },
    ],
  }),
  component: RegisterPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(254),
  password: z.string().min(12, "Use at least 12 characters").max(128),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

type Field = "name" | "email" | "password" | "confirm";

function RegisterPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({}); setFormError(null); setPending(true);
    try {
      const res = await api.auth.register({ name: parsed.data.name, email: parsed.data.email, password: parsed.data.password });
      qc.clear();
      qc.setQueryData(qk.me, res.user);
      navigate({ to: "/", replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const field = (id: Field, label: string, type: string, autoComplete: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`reg-${id}`}>{label}</Label>
      <Input id={`reg-${id}`} type={type} autoComplete={autoComplete} value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })}
        aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `reg-${id}-err` : undefined} />
      {errors[id] && <p id={`reg-${id}-err`} className="text-xs text-destructive">{errors[id]}</p>}
    </div>
  );

  return (
    <AuthLayout title="Create your account" subtitle="You'll get a workspace of your own to start with.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {field("name", "Full name", "text", "name")}
        {field("email", "Work email", "email", "email")}
        {field("password", "Password", "password", "new-password")}
        {field("confirm", "Confirm password", "password", "new-password")}
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
    </AuthLayout>
  );
}
