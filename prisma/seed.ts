/**
 * Creates one test member per role, for trying the app locally without
 * real club data. Safe to run more than once (upserts). Run via
 * `npm run db:seed`.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import type { Role } from "../src/generated/prisma/enums";

const MEMBERS: { email: string; name: string; role: Role }[] = [
  { email: "organiser@example.com", name: "Olivia Organiser", role: "ORGANISER" },
  { email: "trainer@example.com", name: "Tom Trainer", role: "TRAINER" },
  { email: "player@example.com", name: "Priya Player", role: "PLAYER" },
  // A second player so the "preferred training partners" picker has options.
  { email: "player2@example.com", name: "Pieter Player", role: "PLAYER" },
];

async function main() {
  for (const member of MEMBERS) {
    const user = await db.user.upsert({
      where: { email: member.email },
      update: { name: member.name },
      create: { email: member.email, name: member.name },
    });
    // Not a plain upsert: Prisma's compound-unique lookup can't match a
    // null periodId (Postgres unique constraints treat NULL as distinct
    // from every other NULL), so a global role needs a manual check.
    const existingRole = await db.userRole.findFirst({
      where: { userId: user.id, role: member.role, periodId: null },
    });
    if (!existingRole) {
      await db.userRole.create({ data: { userId: user.id, role: member.role } });
    }
    console.log(`Seeded ${member.role} -> ${member.email}`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
