import { beforeEach, describe, expect, it } from "vitest";
import { demoApi as api, resetDemoData, setDemoLatency } from "./demo";
import type { ApiError } from "./errors";

const status = (p: Promise<unknown>) => p.then(() => 200, (e: ApiError) => e.status);

describe("demo API mirrors backend authorization", () => {
  beforeEach(() => { setDemoLatency(0); localStorage.clear(); resetDemoData(); });

  it("rejects calls without a session with 401", async () => {
    expect(await status(api.workspaces.list())).toBe(401);
  });

  it("blocks access to a workspace the user is not a member of (403)", async () => {
    await api.auth.login({ email: "marcus@northwind.dev", password: "x".repeat(8) });
    expect(await status(api.projects.list("ws-harbor"))).toBe(403);
  });

  it("does not let a task id from another workspace be read through your workspace (404)", async () => {
    await api.auth.login({ email: "priya@northwind.dev", password: "x".repeat(8) });
    // p-intake-t1 belongs to ws-harbor; Priya is a member there but addresses it via ws-northwind
    expect(await status(api.tasks.update("ws-northwind", "p-intake-t1", { title: "hijack" }))).toBe(404);
  });

  it("the same user has different roles in different workspaces", async () => {
    await api.auth.login({ email: "priya@northwind.dev", password: "x".repeat(8) });
    const roles = Object.fromEntries((await api.workspaces.list()).map((w) => [w.id, w.role]));
    expect(roles).toEqual({ "ws-northwind": "OWNER", "ws-harbor": "MEMBER", "ws-fieldnote": "ADMIN" });
  });

  it("members cannot create projects (403)", async () => {
    await api.auth.login({ email: "priya@northwind.dev", password: "x".repeat(8) });
    expect(await status(api.projects.create("ws-harbor", { key: "NEW", name: "N", description: "" }))).toBe(403);
  });

  it("refuses to demote the last owner (409)", async () => {
    await api.auth.login({ email: "priya@northwind.dev", password: "x".repeat(8) });
    expect(await status(api.members.updateRole("ws-northwind", "u-priya", { role: "ADMIN" }))).toBe(409);
  });

  it("rejects assignees outside the workspace (400)", async () => {
    await api.auth.login({ email: "priya@northwind.dev", password: "x".repeat(8) });
    expect(await status(api.tasks.create("ws-northwind", "p-portal", { title: "t", priority: "LOW", assigneeId: "u-hannah" }))).toBe(400);
  });

  it("a revoked session can no longer call the API", async () => {
    await api.auth.login({ email: "priya@northwind.dev", password: "x".repeat(8) });
    const current = (await api.sessions.list()).find((s) => s.current)!;
    await api.sessions.revoke(current.id);
    expect(await status(api.auth.me())).toBe(401);
  });

  it("stores no password in browser storage", async () => {
    await api.auth.register({ name: "Test User", email: "t@example.com", password: "secret-password-123" });
    expect(localStorage.getItem("teamspace.demo.v1")).not.toContain("secret-password-123");
  });
});
