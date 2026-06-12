import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ensureUserRow } from "@/lib/users";
import { isGoogleAuthUser } from "@/lib/auth-identities";
import { SettingsNameForm } from "@/components/page/settings-name-form";

export default async function SettingsNamePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (isGoogleAuthUser(user)) {
    redirect("/settings?name_notice=google");
  }

  await ensureUserRow(supabase, user);

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const initialName = profile?.name != null ? String(profile.name) : "";

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
            ← Back to settings
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Display name</h1>
        <p className="text-muted-foreground mt-1">
          Set how your name appears in OmniPost. You can change it here anytime.
        </p>
      </div>

      <SettingsNameForm initialName={initialName} />
    </div>
  );
}
