import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers around Next's navigation APIs: use these instead of
// next/link and next/navigation so links keep the current locale prefix.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
