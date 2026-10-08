import { describe, expect, it } from "vitest";
import { canAssignRole, canDeleteComment, canDeleteTask, canManageMembers, canRemoveMember } from "./permissions";

describe("workspace role rules", () => {
  it("only owners and admins manage members", () => {
    expect(canManageMembers("OWNER")).toBe(true);
    expect(canManageMembers("ADMIN")).toBe(true);
    expect(canManageMembers("MEMBER")).toBe(false);
  });
  it("admins can add members but cannot grant admin or owner", () => {
    expect(canAssignRole("ADMIN", null, "MEMBER")).toBe(true);
    expect(canAssignRole("ADMIN", "MEMBER", "ADMIN")).toBe(false);
    expect(canAssignRole("ADMIN", null, "OWNER")).toBe(false);
  });
  it("admins cannot change another admin's role", () => {
    expect(canAssignRole("ADMIN", "ADMIN", "MEMBER")).toBe(false);
  });
  it("owners can assign any role", () => {
    expect(canAssignRole("OWNER", "MEMBER", "OWNER")).toBe(true);
  });
  it("members cannot assign roles", () => {
    expect(canAssignRole("MEMBER", null, "MEMBER")).toBe(false);
  });
  it("admins remove members but not owners", () => {
    expect(canRemoveMember("ADMIN", "MEMBER", false)).toBe(true);
    expect(canRemoveMember("ADMIN", "OWNER", false)).toBe(false);
    expect(canRemoveMember("MEMBER", "MEMBER", true)).toBe(true);
  });
  it("tasks are deletable by creator or admin; comments by author or admin", () => {
    expect(canDeleteTask("MEMBER", false)).toBe(false);
    expect(canDeleteTask("MEMBER", true)).toBe(true);
    expect(canDeleteComment("MEMBER", false)).toBe(false);
    expect(canDeleteComment("ADMIN", false)).toBe(true);
  });
});
