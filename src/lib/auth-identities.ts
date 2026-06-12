import type { User } from "@supabase/supabase-js";

/** True if the user signed in with Google (OAuth), including linked Google identity. */
export function isGoogleAuthUser(user: User): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.provider === "google") return true;
  const providers = meta.providers;
  if (Array.isArray(providers) && providers.includes("google")) return true;
  return user.identities?.some((i) => i.provider === "google") ?? false;
}
