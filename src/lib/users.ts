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

export async function upsertUserFromAuth(
  supabase: SupabaseClient,
  user: User
): Promise<void> {
  const row = authUserToPublicRow(user);
  await supabase.from("users").upsert(row, { onConflict: "id" });
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
