import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardNav } from "@/components/page/dashboard-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. Get the authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // 2. Fetch specific user info from the public.users table
  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("id", user.id)
    .single();

  // 3. Format navUser using the public table data
  const navUser = {
    id: profile?.id,
    name: profile?.name || " User",
    email: profile?.email,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold text-lg">
            OmniPost AI
          </Link>
          <DashboardNav user={navUser} />
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

