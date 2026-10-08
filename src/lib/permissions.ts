import type { Role } from "./api/types";

// Per-workspace role rules. The Spring Boot backend must enforce the same rules;
// the UI only uses them to hide controls.
const rank: Record<Role, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

export const atLeast = (role: Role, min: Role) => rank[role] >= rank[min];

export const canManageMembers = (role: Role) => atLeast(role, "ADMIN");
export const canManageProjects = (role: Role) => atLeast(role, "ADMIN");
export const canEditTasks = (_role: Role) => true;
export const canDeleteTask = (role: Role, isCreator: boolean) => isCreator || atLeast(role, "ADMIN");
export const canDeleteComment = (role: Role, isAuthor: boolean) => isAuthor || atLeast(role, "ADMIN");

/**
 * Can `actor` give `next` role to a member currently holding `current` (null = new member)?
 * Owners can assign any role. Admins can only add or manage plain members. Members cannot.
 */
export function canAssignRole(actor: Role, current: Role | null, next: Role): boolean {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return next === "MEMBER" && (current === null || current === "MEMBER");
  return false;
}

/** Owners remove anyone, admins remove members, anyone may leave (last-owner rule checked separately). */
export function canRemoveMember(actor: Role, target: Role, isSelf: boolean): boolean {
  if (isSelf) return true;
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return target === "MEMBER";
  return false;
}
