-- Postgres treats every NULL as distinct from every other NULL in a unique
-- constraint, so the existing (userId, role, periodId) unique constraint
-- does not stop the same user/role pair being inserted twice as a global
-- role (periodId IS NULL). This partial index closes that gap. It can't be
-- expressed in schema.prisma - Prisma's DSL has no filtered/partial index
-- syntax - so it's a hand-written migration; prisma/seed.ts already works
-- around the same limitation with a manual find-then-create instead of an
-- upsert.
CREATE UNIQUE INDEX "UserRole_userId_role_global_key" ON "UserRole" ("userId", "role") WHERE "periodId" IS NULL;
