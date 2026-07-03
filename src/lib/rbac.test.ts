import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { hasRole, isOrganiser, isPlayer, isTrainer } from "./rbac";

function sessionWithRoles(roles: Session["user"]["roles"]): Session {
  return {
    expires: new Date(Date.now() + 60_000).toISOString(),
    user: { id: "user_1", roles },
  };
}

describe("rbac", () => {
  it("returns false for a null session", () => {
    expect(hasRole(null, "ORGANISER")).toBe(false);
  });

  it("returns false when the user doesn't have the role", () => {
    const session = sessionWithRoles(["PLAYER"]);
    expect(hasRole(session, "ORGANISER")).toBe(false);
  });

  it("returns true when the user has the role among several", () => {
    const session = sessionWithRoles(["PLAYER", "TRAINER"]);
    expect(hasRole(session, "TRAINER")).toBe(true);
  });

  it("exposes role-specific helpers", () => {
    const session = sessionWithRoles(["ORGANISER", "PLAYER"]);
    expect(isOrganiser(session)).toBe(true);
    expect(isPlayer(session)).toBe(true);
    expect(isTrainer(session)).toBe(false);
  });
});
