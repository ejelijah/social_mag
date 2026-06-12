import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ensureUserRow } from "@/lib/users";
import { isGoogleAuthUser } from "@/lib/auth-identities";
import { AccountManager } from "@/components/page/account-manager";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; name_notice?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  await ensureUserRow(supabase, user);

  const { data: dbUser, error: nameError } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const params = await searchParams;
  const error = params.error;
  const nameNotice = params.name_notice;
  const canEditName = !isGoogleAuthUser(user);

  const displayName =
    !nameError && dbUser?.name != null && String(dbUser.name).trim() !== ""
      ? String(dbUser.name).trim()
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your connected social accounts
        </p>
      </div>

      {nameNotice === "google" && (
        <Alert>
          <AlertDescription>
            Google sign-in uses the name on your Google account. To change it, update your Google profile.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error === "missing_params" && "Missing OAuth parameters. Please try again."}
            {error === "invalid_state" && "Invalid OAuth state. Please try again."}
            {error === "token_exchange_failed" && "Failed to exchange token. Check your API credentials."}
            {error === "callback_failed" && "OAuth callback failed. Please try again."}
            {!["missing_params", "invalid_state", "token_exchange_failed", "callback_failed"].includes(error) &&
              error}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Hello {displayName ?? "there"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canEditName && (
              <p className="text-sm text-muted-foreground">
                <Link
                  href="/settings/name"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Change display name
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
        <AccountManager />
      </div>
    </div>
  );
}
