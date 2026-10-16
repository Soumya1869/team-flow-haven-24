import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("Spring Boot HTTP authentication", () => {
  it("bootstraps CSRF and shares one refresh for concurrent unauthorized requests", async () => {
    const calls: Array<{ path: string; init: RequestInit | undefined }> = [];
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ path: input, init });
      if (input.endsWith("/csrf")) return Response.json({ token: "csrf-value" });
      if (input.endsWith("/refresh")) return Response.json({ accessToken: "access-value", expiresIn: 600, user: { id: "u" } });
      const headers = init?.headers as Record<string, string>;
      return headers["Authorization"] === "Bearer access-value" ? Response.json({ id: "u" }) : Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { httpApi } = await import("./http");
    await Promise.all([httpApi.auth.me(), httpApi.auth.me()]);
    expect(calls.filter((c) => c.path.endsWith("/refresh"))).toHaveLength(1);
    const refresh = calls.find((c) => c.path.endsWith("/refresh"))!;
    expect(refresh.init?.credentials).toBe("include");
    expect(refresh.init?.headers).toMatchObject({ "X-XSRF-TOKEN": "csrf-value" });
  });

  it("does not refresh an expired bearer token during logout", async () => {
    const fetchMock = vi.fn(async (path: string) => path.endsWith("/csrf") ? Response.json({ token: "csrf" }) : new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { httpApi } = await import("./http");
    await httpApi.auth.logout();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([path]) => path.endsWith("/refresh"))).toBe(false);
  });
});
