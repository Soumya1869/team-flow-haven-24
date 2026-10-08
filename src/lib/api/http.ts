import { ApiError } from "./errors";
import type { AuthResponse, TaskQuery, TeamSpaceApi } from "./types";

/**
 * Typed client for the Spring Boot API (see docs/API.md).
 * - Access token: kept in a module variable (memory only), never in localStorage.
 * - Refresh token: Secure HttpOnly SameSite cookie set by the server; JS never sees it.
 * - CSRF: Spring's CookieCsrfTokenRepository sets XSRF-TOKEN; we echo it as X-XSRF-TOKEN on unsafe requests.
 */
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

const base = () => (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function raw(method: Method, path: string, body?: unknown, withAuth = true) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (withAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (method !== "GET") {
    const xsrf = readCookie("XSRF-TOKEN");
    if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
  }
  return fetch(base() + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include", // needed for the refresh cookie; CORS must allow exactly this origin
  });
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const p = await res.json();
    return new ApiError(res.status, p.code ?? p.title ?? "ERROR", p.detail ?? p.message ?? res.statusText, p.errors);
  } catch {
    return new ApiError(res.status, "ERROR", res.statusText || "Request failed");
  }
}

async function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await raw("POST", "/api/auth/refresh", undefined, false);
      if (!res.ok) { accessToken = null; return false; }
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

async function req<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res = await raw(method, path, body);
  if (res.status === 401 && (await refresh())) res = await raw(method, path, body);
  if (!res.ok) throw await toError(res);
  if (res.status === 204 || res.status === 202) return undefined as T;
  return (await res.json()) as T;
}

async function authCall(path: string, body: unknown): Promise<AuthResponse> {
  const res = await raw("POST", path, body, false);
  if (!res.ok) throw await toError(res);
  const data = (await res.json()) as AuthResponse;
  accessToken = data.accessToken;
  return data;
}

const qs = (q?: TaskQuery) => {
  const p = new URLSearchParams();
  Object.entries(q ?? {}).forEach(([k, v]) => v && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};
const w = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}`;

export const httpApi: TeamSpaceApi = {
  mode: "http",
  auth: {
    login: (b) => authCall("/api/auth/login", b),
    register: (b) => authCall("/api/auth/register", b),
    logout: async () => { try { await req<void>("POST", "/api/auth/logout"); } finally { accessToken = null; } },
    me: () => req("GET", "/api/auth/me"),
    changePassword: (b) => req("POST", "/api/auth/password", b),
    updateProfile: (b) => req("PATCH", "/api/users/me", b),
    requestPasswordReset: (email) => req("POST", "/api/auth/password-reset/request", { email }),
    resendVerification: () => req("POST", "/api/auth/verify-email/resend"),
  },
  sessions: {
    list: () => req("GET", "/api/sessions"),
    revoke: (id) => req("DELETE", `/api/sessions/${id}`),
    revokeOthers: () => req("DELETE", "/api/sessions/others"),
  },
  workspaces: {
    list: () => req("GET", "/api/workspaces"),
    create: (b) => req("POST", "/api/workspaces", b),
  },
  members: {
    list: (ws) => req("GET", `${w(ws)}/members`),
    add: (ws, b) => req("POST", `${w(ws)}/members`, b),
    updateRole: (ws, id, b) => req("PATCH", `${w(ws)}/members/${id}`, b),
    remove: (ws, id) => req("DELETE", `${w(ws)}/members/${id}`),
  },
  projects: {
    list: (ws) => req("GET", `${w(ws)}/projects`),
    create: (ws, b) => req("POST", `${w(ws)}/projects`, b),
    remove: (ws, id) => req("DELETE", `${w(ws)}/projects/${id}`),
  },
  tasks: {
    list: (ws, p, q) => req("GET", `${w(ws)}/projects/${p}/tasks${qs(q)}`),
    create: (ws, p, b) => req("POST", `${w(ws)}/projects/${p}/tasks`, b),
    update: (ws, id, b) => req("PATCH", `${w(ws)}/tasks/${id}`, b),
    move: (ws, id, b) => req("POST", `${w(ws)}/tasks/${id}/move`, b),
    remove: (ws, id) => req("DELETE", `${w(ws)}/tasks/${id}`),
  },
  comments: {
    list: (ws, t) => req("GET", `${w(ws)}/tasks/${t}/comments`),
    create: (ws, t, b) => req("POST", `${w(ws)}/tasks/${t}/comments`, b),
    remove: (ws, id) => req("DELETE", `${w(ws)}/comments/${id}`),
  },
};
