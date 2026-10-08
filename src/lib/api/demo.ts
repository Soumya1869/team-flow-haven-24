import { ApiError } from "./errors";
import { createSeed, type DemoDb, type DemoTask } from "./seed";
import type {
  CommentDto, MemberDto, ProjectDto, Role, SessionDto, TaskDto, TeamSpaceApi, UserDto, WorkspaceDto,
} from "./types";
import {
  canAssignRole, canDeleteComment, canDeleteTask, canManageProjects, canRemoveMember,
} from "../permissions";

/**
 * Browser-only demo implementation of the TeamSpace API. It mimics the authorization
 * checks the Spring Boot backend must perform, but it is NOT real authentication:
 * there are no passwords, no tokens, and anyone with this browser can edit the data.
 */
const KEY = "teamspace.demo.v1";
let db: DemoDb | null = null;
let latency = 200;

export const setDemoLatency = (ms: number) => { latency = ms; };

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}
function load(): DemoDb {
  if (db) return db;
  const raw = storage()?.getItem(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoDb;
      if (parsed.version === 1) { db = parsed; return db; }
    } catch { /* fall through to reseed */ }
  }
  db = createSeed();
  save();
  return db;
}
function save() { if (db) storage()?.setItem(KEY, JSON.stringify(db)); }
export function resetDemoData() { db = createSeed(); save(); }

const wait = () => new Promise((r) => setTimeout(r, latency));
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

async function run<T>(fn: (d: DemoDb) => T): Promise<T> {
  await wait();
  const d = load();
  const result = fn(d);
  save();
  return structuredClone(result);
}

function requireUser(d: DemoDb) {
  const u = d.users.find((x) => x.id === d.currentUserId);
  if (!u || !d.sessions.some((s) => s.id === d.currentSessionId)) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue");
  }
  return u;
}
function requireMember(d: DemoDb, ws: string): Role {
  const u = requireUser(d);
  const m = d.memberships.find((x) => x.workspaceId === ws && x.userId === u.id);
  if (!m) throw new ApiError(403, "NOT_A_MEMBER", "You are not a member of this workspace");
  return m.role;
}
const forbid = (msg: string) => new ApiError(403, "FORBIDDEN", msg);
const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} not found`);

const userDto = (u: DemoDb["users"][number]): UserDto => ({ ...u });
function taskDto(d: DemoDb, t: DemoTask): TaskDto {
  const { workspaceId: _w, ...rest } = t;
  return { ...rest, commentCount: d.comments.filter((c) => c.taskId === t.id).length };
}
function memberDto(d: DemoDb, ws: string, userId: string): MemberDto {
  const m = d.memberships.find((x) => x.workspaceId === ws && x.userId === userId)!;
  const u = d.users.find((x) => x.id === userId)!;
  return { userId, name: u.name, email: u.email, role: m.role, joinedAt: m.joinedAt };
}
function projectDto(d: DemoDb, p: DemoDb["projects"][number]): ProjectDto {
  const ts = d.tasks.filter((t) => t.projectId === p.id);
  const { seq: _s, ...rest } = p;
  return { ...rest, taskCount: ts.length, doneCount: ts.filter((t) => t.status === "DONE").length };
}
function workspaceDto(d: DemoDb, ws: DemoDb["workspaces"][number], role: Role): WorkspaceDto {
  return { id: ws.id, name: ws.name, slug: ws.slug, role, memberCount: d.memberships.filter((m) => m.workspaceId === ws.id).length };
}
function taskInWorkspace(d: DemoDb, ws: string, taskId: string) {
  const t = d.tasks.find((x) => x.id === taskId && x.workspaceId === ws);
  if (!t) throw notFound("Task");
  return t;
}
function assertAssignee(d: DemoDb, ws: string, assigneeId: string | null | undefined) {
  if (assigneeId && !d.memberships.some((m) => m.workspaceId === ws && m.userId === assigneeId)) {
    throw new ApiError(400, "ASSIGNEE_NOT_MEMBER", "Assignee must be a member of this workspace");
  }
}
function ownerCount(d: DemoDb, ws: string) {
  return d.memberships.filter((m) => m.workspaceId === ws && m.role === "OWNER").length;
}
function startSession(d: DemoDb, userId: string) {
  const s = { id: uid(), userId, userAgent: typeof navigator === "undefined" ? "Unknown" : summarizeUA(navigator.userAgent), ipAddress: "127.0.0.1 (demo)", createdAt: now(), lastUsedAt: now() };
  d.sessions.push(s);
  d.currentUserId = userId;
  d.currentSessionId = s.id;
}
function summarizeUA(ua: string) {
  const browser = /Firefox/.test(ua) ? "Firefox" : /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
  const os = /Mac/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}
const demoToken = () => ({ accessToken: "demo-mode-no-real-token", expiresIn: 900 });

export const demoApi: TeamSpaceApi = {
  mode: "demo",
  auth: {
    login: ({ email }) => run((d) => {
      const u = d.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!u) throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
      startSession(d, u.id);
      return { ...demoToken(), user: userDto(u) };
    }),
    register: ({ name, email }) => run((d) => {
      const normalized = email.trim().toLowerCase();
      if (d.users.some((x) => x.email.toLowerCase() === normalized)) {
        throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists", { email: "Already registered" });
      }
      const u = { id: uid(), name: name.trim(), email: normalized, emailVerified: false, createdAt: now() };
      d.users.push(u);
      const ws = { id: uid(), name: `${u.name.split(" ")[0]}'s workspace`, slug: `ws-${u.id.slice(0, 6)}`, createdAt: now() };
      d.workspaces.push(ws);
      d.memberships.push({ workspaceId: ws.id, userId: u.id, role: "OWNER", joinedAt: now() });
      startSession(d, u.id);
      return { ...demoToken(), user: userDto(u) };
    }),
    logout: () => run((d) => {
      d.sessions = d.sessions.filter((s) => s.id !== d.currentSessionId);
      d.currentUserId = null;
      d.currentSessionId = null;
    }),
    me: () => run((d) => userDto(requireUser(d))),
    changePassword: ({ newPassword }) => run((d) => {
      requireUser(d);
      if (newPassword.length < 12) throw new ApiError(400, "VALIDATION", "Password must be at least 12 characters", { newPassword: "At least 12 characters" });
      // Demo mode stores no passwords. Real backend: verify current password, BCrypt/Argon2 hash, revoke other sessions.
    }),
    updateProfile: ({ name }) => run((d) => {
      const u = requireUser(d);
      u.name = name.trim();
      return userDto(u);
    }),
    requestPasswordReset: () => run(() => undefined), // always 202: never reveal whether the email exists
    resendVerification: () => run((d) => { requireUser(d); }),
  },
  sessions: {
    list: () => run((d): SessionDto[] => {
      const u = requireUser(d);
      return d.sessions.filter((s) => s.userId === u.id)
        .map(({ userId: _u, ...s }) => ({ ...s, current: s.id === d.currentSessionId }))
        .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
    }),
    revoke: (id) => run((d) => {
      const u = requireUser(d);
      const s = d.sessions.find((x) => x.id === id && x.userId === u.id);
      if (!s) throw notFound("Session");
      d.sessions = d.sessions.filter((x) => x.id !== id);
      if (id === d.currentSessionId) { d.currentSessionId = null; d.currentUserId = null; }
    }),
    revokeOthers: () => run((d) => {
      const u = requireUser(d);
      d.sessions = d.sessions.filter((s) => s.userId !== u.id || s.id === d.currentSessionId);
    }),
  },
  workspaces: {
    list: () => run((d) => {
      const u = requireUser(d);
      return d.memberships.filter((m) => m.userId === u.id)
        .map((m) => workspaceDto(d, d.workspaces.find((w) => w.id === m.workspaceId)!, m.role));
    }),
    create: ({ name }) => run((d) => {
      const u = requireUser(d);
      if (!name.trim()) throw new ApiError(400, "VALIDATION", "Name is required");
      const ws = { id: uid(), name: name.trim(), slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), createdAt: now() };
      d.workspaces.push(ws);
      d.memberships.push({ workspaceId: ws.id, userId: u.id, role: "OWNER", joinedAt: now() });
      return workspaceDto(d, ws, "OWNER");
    }),
  },
  members: {
    list: (ws) => run((d) => {
      requireMember(d, ws);
      return d.memberships.filter((m) => m.workspaceId === ws).map((m) => memberDto(d, ws, m.userId));
    }),
    add: (ws, { email, role }) => run((d) => {
      const actor = requireMember(d, ws);
      if (!canAssignRole(actor, null, role)) throw forbid("Your role cannot add members with this role");
      const normalized = email.trim().toLowerCase();
      let u = d.users.find((x) => x.email.toLowerCase() === normalized);
      if (!u) {
        const local = normalized.split("@")[0] ?? "new member";
        u = { id: uid(), name: local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), email: normalized, emailVerified: false, createdAt: now() };
        d.users.push(u);
      }
      if (d.memberships.some((m) => m.workspaceId === ws && m.userId === u!.id)) {
        throw new ApiError(409, "ALREADY_MEMBER", "This person is already a member");
      }
      d.memberships.push({ workspaceId: ws, userId: u.id, role, joinedAt: now() });
      return memberDto(d, ws, u.id);
    }),
    updateRole: (ws, userId, { role }) => run((d) => {
      const actor = requireMember(d, ws);
      const target = d.memberships.find((m) => m.workspaceId === ws && m.userId === userId);
      if (!target) throw notFound("Member");
      if (!canAssignRole(actor, target.role, role)) throw forbid("Your role cannot make this change");
      if (target.role === "OWNER" && role !== "OWNER" && ownerCount(d, ws) === 1) {
        throw new ApiError(409, "LAST_OWNER", "A workspace needs at least one owner");
      }
      target.role = role;
      return memberDto(d, ws, userId);
    }),
    remove: (ws, userId) => run((d) => {
      const actor = requireMember(d, ws);
      const me = d.currentUserId!;
      const target = d.memberships.find((m) => m.workspaceId === ws && m.userId === userId);
      if (!target) throw notFound("Member");
      if (!canRemoveMember(actor, target.role, userId === me)) throw forbid("Your role cannot remove this member");
      if (target.role === "OWNER" && ownerCount(d, ws) === 1) throw new ApiError(409, "LAST_OWNER", "A workspace needs at least one owner");
      d.memberships = d.memberships.filter((m) => m !== target);
      d.tasks.forEach((t) => { if (t.workspaceId === ws && t.assigneeId === userId) t.assigneeId = null; });
    }),
  },
  projects: {
    list: (ws) => run((d) => {
      requireMember(d, ws);
      return d.projects.filter((p) => p.workspaceId === ws).map((p) => projectDto(d, p));
    }),
    create: (ws, req) => run((d) => {
      const role = requireMember(d, ws);
      if (!canManageProjects(role)) throw forbid("Only owners and admins can create projects");
      const key = req.key.trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9]{1,5}$/.test(key)) throw new ApiError(400, "VALIDATION", "Key must be 2–6 letters or digits", { key: "Invalid key" });
      if (d.projects.some((p) => p.workspaceId === ws && p.key === key)) throw new ApiError(409, "KEY_TAKEN", "Project key already used in this workspace");
      const p = { id: uid(), workspaceId: ws, key, name: req.name.trim(), description: req.description.trim(), colorIndex: d.projects.length % 5, createdAt: now(), seq: 0 };
      d.projects.push(p);
      return projectDto(d, p);
    }),
    remove: (ws, projectId) => run((d) => {
      const role = requireMember(d, ws);
      if (!canManageProjects(role)) throw forbid("Only owners and admins can delete projects");
      if (!d.projects.some((p) => p.id === projectId && p.workspaceId === ws)) throw notFound("Project");
      const taskIds = new Set(d.tasks.filter((t) => t.projectId === projectId).map((t) => t.id));
      d.projects = d.projects.filter((p) => p.id !== projectId);
      d.tasks = d.tasks.filter((t) => !taskIds.has(t.id));
      d.comments = d.comments.filter((c) => !taskIds.has(c.taskId));
    }),
  },
  tasks: {
    list: (ws, projectId, query) => run((d) => {
      requireMember(d, ws);
      if (!d.projects.some((p) => p.id === projectId && p.workspaceId === ws)) throw notFound("Project");
      const q = query?.q?.toLowerCase();
      return d.tasks
        .filter((t) => t.projectId === projectId)
        .filter((t) => !q || t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q))
        .filter((t) => !query?.assigneeId || t.assigneeId === query.assigneeId)
        .filter((t) => !query?.priority || t.priority === query.priority)
        .filter((t) => !query?.status || t.status === query.status)
        .sort((a, b) => a.position - b.position)
        .map((t) => taskDto(d, t));
    }),
    create: (ws, projectId, req) => run((d) => {
      const u = requireUser(d);
      requireMember(d, ws);
      const p = d.projects.find((x) => x.id === projectId && x.workspaceId === ws);
      if (!p) throw notFound("Project");
      if (!req.title.trim()) throw new ApiError(400, "VALIDATION", "Title is required", { title: "Required" });
      assertAssignee(d, ws, req.assigneeId);
      p.seq += 1;
      const status = req.status ?? "TODO";
      const position = Math.max(-1, ...d.tasks.filter((t) => t.projectId === projectId && t.status === status).map((t) => t.position)) + 1;
      const t: DemoTask = {
        id: uid(), workspaceId: ws, projectId, key: `${p.key}-${p.seq}`, title: req.title.trim(), description: req.description?.trim() ?? "",
        status, priority: req.priority, assigneeId: req.assigneeId ?? null, createdById: u.id, dueDate: req.dueDate ?? null,
        position, createdAt: now(), updatedAt: now(),
      };
      d.tasks.push(t);
      return taskDto(d, t);
    }),
    update: (ws, taskId, req) => run((d) => {
      requireMember(d, ws);
      const t = taskInWorkspace(d, ws, taskId);
      if (req.title !== undefined && !req.title.trim()) throw new ApiError(400, "VALIDATION", "Title is required", { title: "Required" });
      assertAssignee(d, ws, req.assigneeId);
      Object.assign(t, {
        ...(req.title !== undefined && { title: req.title.trim() }),
        ...(req.description !== undefined && { description: req.description }),
        ...(req.status !== undefined && { status: req.status }),
        ...(req.priority !== undefined && { priority: req.priority }),
        ...(req.assigneeId !== undefined && { assigneeId: req.assigneeId }),
        ...(req.dueDate !== undefined && { dueDate: req.dueDate }),
        updatedAt: now(),
      });
      return taskDto(d, t);
    }),
    move: (ws, taskId, { status, position }) => run((d) => {
      requireMember(d, ws);
      const t = taskInWorkspace(d, ws, taskId);
      t.status = status;
      t.position = position;
      t.updatedAt = now();
      return taskDto(d, t);
    }),
    remove: (ws, taskId) => run((d) => {
      const role = requireMember(d, ws);
      const t = taskInWorkspace(d, ws, taskId);
      if (!canDeleteTask(role, t.createdById === d.currentUserId)) throw forbid("Only the creator or an admin can delete this task");
      d.tasks = d.tasks.filter((x) => x.id !== taskId);
      d.comments = d.comments.filter((c) => c.taskId !== taskId);
    }),
  },
  comments: {
    list: (ws, taskId) => run((d): CommentDto[] => {
      requireMember(d, ws);
      taskInWorkspace(d, ws, taskId);
      return d.comments.filter((c) => c.taskId === taskId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c) => {
          const a = d.users.find((u) => u.id === c.authorId);
          return { id: c.id, taskId: c.taskId, body: c.body, createdAt: c.createdAt, author: { id: c.authorId, name: a?.name ?? "Former member" } };
        });
    }),
    create: (ws, taskId, { body }) => run((d): CommentDto => {
      const u = requireUser(d);
      requireMember(d, ws);
      taskInWorkspace(d, ws, taskId);
      if (!body.trim()) throw new ApiError(400, "VALIDATION", "Comment cannot be empty");
      const c = { id: uid(), workspaceId: ws, taskId, authorId: u.id, body: body.trim(), createdAt: now() };
      d.comments.push(c);
      return { id: c.id, taskId, body: c.body, createdAt: c.createdAt, author: { id: u.id, name: u.name } };
    }),
    remove: (ws, commentId) => run((d) => {
      const role = requireMember(d, ws);
      const c = d.comments.find((x) => x.id === commentId && x.workspaceId === ws);
      if (!c) throw notFound("Comment");
      if (!canDeleteComment(role, c.authorId === d.currentUserId)) throw forbid("You can only delete your own comments");
      d.comments = d.comments.filter((x) => x.id !== commentId);
    }),
  },
};
