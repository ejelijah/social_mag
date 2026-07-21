import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { PublicUserRow } from "@/types/database";
import { isGoogleAuthUser } from "@/lib/auth-identities";

export function authUserToPublicRow(user: User): PublicUserRow {
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  const trimmed = name?.trim() ?? "";
  const needs_name_setup = isGoogleAuthUser(user)
    ? false
    : trimmed.length === 0;

  return {
    id: user.id,
    email: user.email ?? null,
    name,
    avatar_url: avatarUrl,
    needs_name_setup,
    updated_at: new Date().toISOString(),
  };
}

export async function upsertUserFromAuth(supabase: any, user: any) {
const { data, error } = await supabase
.from("users")
.upsert({
id: user.id,
email: user.email,
full_name: user.user_metadata?.full_name,
avatar_url: user.user_metadata?.avatar_url,
updated_at: new Date().toISOString(),
})
.select() // This allows you to get the data back after the upsert
.single(); // This ensures you get one object back instead of an array
return { data, error }; // This removes the 'void' type error
}

export async function ensureUserRow(
  supabase: SupabaseClient,
  user: User
): Promise<void> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("ensureUserRow select:", error);
    return;
  }

  if (!data) {
    await upsertUserFromAuth(supabase, user);
  }
}
