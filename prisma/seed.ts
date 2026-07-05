/**
 * Seeds test data for trying the app locally without real club data:
 * one member per role, a handful of players, and a demo training period with
 * some sign-ups and payments so the members roster has something to show.
 * Safe to run more than once (upserts). Run via `npm run db:seed`.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import type { PaymentStatus, Role } from "../src/generated/prisma/enums";

interface Member {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  skillLevel?: number;
  /** Whether this player signs up for the demo period. */
  enrolled?: boolean;
  notes?: string;
  /** Payment state for the demo period; omit for no payment record. */
  payment?: PaymentStatus;
}

const MEMBERS: Member[] = [
  { email: "organiser@example.com", firstName: "Olivia", lastName: "Organiser", role: "ORGANISER" },
  { email: "trainer@example.com", firstName: "Tom", lastName: "Trainer", role: "TRAINER" },
  { email: "player@example.com", firstName: "Priya", lastName: "Player", role: "PLAYER", skillLevel: 5, enrolled: true, notes: "Liefst training na 19:00.", payment: "PAID" },
  { email: "player2@example.com", firstName: "Pieter", lastName: "Player", role: "PLAYER", skillLevel: 6, enrolled: true, payment: "PENDING" },
  { email: "sanne@example.com", firstName: "Sanne", lastName: "de Vries", role: "PLAYER", skillLevel: 3, enrolled: true, notes: "Begin net, graag een rustige groep.", payment: "PAID" },
  { email: "bram@example.com", firstName: "Bram", lastName: "Jansen", role: "PLAYER", skillLevel: 7, enrolled: false },
  { email: "lotte@example.com", firstName: "Lotte", lastName: "Bakker", role: "PLAYER", skillLevel: 4, enrolled: true, payment: "PAID" },
  { email: "youssef@example.com", firstName: "Youssef", lastName: "El Amrani", role: "PLAYER", skillLevel: 8, enrolled: false, payment: "PENDING" },
];

/** A UTC-midnight date `days` from today. */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function main() {
  const members = new Map<string, { id: string } & Member>();
  for (const member of MEMBERS) {
    const user = await db.user.upsert({
      where: { email: member.email },
      update: {
        name: `${member.firstName} ${member.lastName}`,
        firstName: member.firstName,
        lastName: member.lastName,
        skillLevel: member.skillLevel ?? null,
      },
      create: {
        email: member.email,
        name: `${member.firstName} ${member.lastName}`,
        firstName: member.firstName,
        lastName: member.lastName,
        skillLevel: member.skillLevel ?? null,
      },
    });
    // Not a plain upsert: Prisma's compound-unique lookup can't match a null
    // periodId (Postgres treats NULL as distinct from every other NULL), so a
    // global role needs a manual existence check.
    const existingRole = await db.userRole.findFirst({
      where: { userId: user.id, role: member.role, periodId: null },
    });
    if (!existingRole) {
      await db.userRole.create({ data: { userId: user.id, role: member.role } });
    }
    members.set(member.email, { ...member, id: user.id });
    console.log(`Seeded ${member.role} -> ${member.email}`);
  }

  // Demo period, open for sign-ups, with two weekly blocks.
  const DEMO_NAME = "Demo najaar 2026";
  let period = await db.trainingPeriod.findFirst({ where: { name: DEMO_NAME } });
  if (!period) {
    period = await db.trainingPeriod.create({
      data: {
        name: DEMO_NAME,
        startDate: daysFromNow(7),
        endDate: daysFromNow(7 + 8 * 7),
        sessionDurationMinutes: 60,
        priceCents: 12000,
        preferenceDeadline: daysFromNow(5),
        status: "OPEN",
        recurringSlots: {
          create: [
            { weekday: "MONDAY", startTime: "18:00", endTime: "19:00", capacity: 4, label: "Groep 1" },
            { weekday: "TUESDAY", startTime: "19:00", endTime: "20:00", capacity: 2, label: "Groep 2" },
          ],
        },
      },
    });
    console.log(`Seeded demo period -> ${DEMO_NAME}`);
  }
  const slots = await db.recurringSlot.findMany({ where: { periodId: period.id }, orderBy: { startTime: "asc" } });
  const firstSlot = slots[0];

  for (const member of members.values()) {
    if (member.role !== "PLAYER") continue;
    if (member.enrolled && firstSlot) {
      await db.preference.upsert({
        where: { userId_periodId: { userId: member.id, periodId: period.id } },
        update: { skillLevel: member.skillLevel ?? 5, notes: member.notes ?? null },
        create: {
          userId: member.id,
          periodId: period.id,
          preferredWeekdays: [firstSlot.weekday],
          skillLevel: member.skillLevel ?? 5,
          notes: member.notes ?? null,
          preferredSlots: { connect: { id: firstSlot.id } },
        },
      });
    }
    if (member.payment) {
      await db.payment.upsert({
        where: { userId_periodId: { userId: member.id, periodId: period.id } },
        update: { status: member.payment, paidAt: member.payment === "PAID" ? new Date() : null },
        create: {
          userId: member.id,
          periodId: period.id,
          amountCents: period.priceCents,
          status: member.payment,
          paidAt: member.payment === "PAID" ? new Date() : null,
        },
      });
    }
  }
  console.log("Seeded demo sign-ups and payments.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
