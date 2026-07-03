import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

// Email-only ("magic link") sign-in: no passwords to hash, reset or leak.
// See SPECS.md §9 for the reasoning.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
      // Outside production, print the sign-in link to the server console
      // instead of sending a real email - lets you sign in locally without
      // a Resend account. See README "Trying it out locally".
      ...(process.env.NODE_ENV !== "production" && {
        sendVerificationRequest: async ({ identifier, url }) => {
          console.log(`\n[dev] Sign-in link for ${identifier}:\n${url}\n`);
        },
      }),
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    // Attach the member's roles and id to the session so pages/route
    // handlers can do access control without a separate DB round trip.
    async session({ session, user }) {
      const roles = await db.userRole.findMany({
        where: { userId: user.id },
        select: { role: true },
      });
      session.user.id = user.id;
      session.user.roles = roles.map((r) => r.role);
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: Role[];
    } & import("next-auth").DefaultSession["user"];
  }
}
