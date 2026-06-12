import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export async function getAuthUser(): Promise<{
  user: User;
  supabase: Awaited<ReturnType<typeof createClient>>;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { user, supabase };
}

export async function requireAuthUser(): Promise<
  | { user: User; supabase: Awaited<ReturnType<typeof createClient>> }
  | { response: NextResponse }
> {
  const session = await getAuthUser();
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return session;
}
