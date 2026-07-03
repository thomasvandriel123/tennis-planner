import type { Role } from "@/generated/prisma/enums";
import type { Session } from "next-auth";

/** Whether the signed-in user holds the given role (a user can hold several). */
export function hasRole(session: Session | null, role: Role): boolean {
  return session?.user.roles.includes(role) ?? false;
}

export const isOrganiser = (session: Session | null) => hasRole(session, "ORGANISER");
export const isTrainer = (session: Session | null) => hasRole(session, "TRAINER");
export const isPlayer = (session: Session | null) => hasRole(session, "PLAYER");
