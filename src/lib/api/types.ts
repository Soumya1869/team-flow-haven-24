// DTOs shared with the Spring Boot API. Mirror these as Java records. See docs/API.md.

export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"];

export interface UserDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

/** Access token lives in memory only. Refresh token is a Secure HttpOnly cookie set by the server. */
export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  role: Role; // caller's role in this workspace
  memberCount: number;
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export interface ProjectDto {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string;
  colorIndex: number;
  taskCount: number;
  doneCount: number;
  createdAt: string;
}

export interface TaskDto {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  createdById: string;
  dueDate: string | null; // ISO date yyyy-mm-dd
  position: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDto {
  id: string;
  taskId: string;
  author: { id: string; name: string };
  body: string;
  createdAt: string;
}

export interface SessionDto {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export interface LoginRequest { email: string; password: string }
export interface RegisterRequest { name: string; email: string; password: string }
export interface ChangePasswordRequest { currentPassword: string; newPassword: string }
export interface UpdateProfileRequest { name: string }
export interface CreateWorkspaceRequest { name: string }
export interface AddMemberRequest { email: string; role: Role }
export interface UpdateMemberRoleRequest { role: Role }
export interface CreateProjectRequest { key: string; name: string; description: string }
export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority: Priority;
  assigneeId?: string | null;
  dueDate?: string | null;
}
export type UpdateTaskRequest = Partial<CreateTaskRequest>;
export interface MoveTaskRequest { status: TaskStatus; position: number }
export interface CreateCommentRequest { body: string }
export interface TaskQuery { q?: string; assigneeId?: string; priority?: Priority; status?: TaskStatus }

export interface TeamSpaceApi {
  mode: "demo" | "http";
  auth: {
    login(req: LoginRequest): Promise<AuthResponse>;
    register(req: RegisterRequest): Promise<AuthResponse>;
    logout(): Promise<void>;
    me(): Promise<UserDto>;
    changePassword(req: ChangePasswordRequest): Promise<void>;
    updateProfile(req: UpdateProfileRequest): Promise<UserDto>;
    requestPasswordReset(email: string): Promise<void>;
    confirmPasswordReset(token: string, newPassword: string): Promise<void>;
    confirmEmail(token: string): Promise<void>;
    resendVerification(): Promise<void>;
  };
  sessions: {
    list(): Promise<SessionDto[]>;
    revoke(id: string): Promise<void>;
    revokeOthers(): Promise<void>;
  };
  workspaces: {
    list(): Promise<WorkspaceDto[]>;
    create(req: CreateWorkspaceRequest): Promise<WorkspaceDto>;
  };
  members: {
    list(ws: string): Promise<MemberDto[]>;
    add(ws: string, req: AddMemberRequest): Promise<MemberDto>;
    updateRole(ws: string, userId: string, req: UpdateMemberRoleRequest): Promise<MemberDto>;
    remove(ws: string, userId: string): Promise<void>;
  };
  projects: {
    list(ws: string): Promise<ProjectDto[]>;
    create(ws: string, req: CreateProjectRequest): Promise<ProjectDto>;
    remove(ws: string, projectId: string): Promise<void>;
  };
  tasks: {
    list(ws: string, projectId: string, query?: TaskQuery): Promise<TaskDto[]>;
    create(ws: string, projectId: string, req: CreateTaskRequest): Promise<TaskDto>;
    update(ws: string, taskId: string, req: UpdateTaskRequest): Promise<TaskDto>;
    move(ws: string, taskId: string, req: MoveTaskRequest): Promise<TaskDto>;
    remove(ws: string, taskId: string): Promise<void>;
  };
  comments: {
    list(ws: string, taskId: string): Promise<CommentDto[]>;
    create(ws: string, taskId: string, req: CreateCommentRequest): Promise<CommentDto>;
    remove(ws: string, commentId: string): Promise<void>;
  };
}
