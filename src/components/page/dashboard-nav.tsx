"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// 1. Change this import to your Supabase client
import { createClient } from "@/utils/supabase/client"; 
import { LayoutDashboard, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardNavProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient(); // 2. Initialize Supabase

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/"); // 3. Redirect manually after sign out
    router.refresh();
  };

  return (
    <nav className="flex items-center gap-4">
      <Link
        href="/dashboard"
        className={cn(
          "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
          pathname === "/dashboard" ? "text-primary" : "text-muted-foreground"
        )}
      >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Link>
      <Link
        href="/settings"
        className={cn(
          "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
          pathname?.startsWith("/settings") ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Settings className="h-4 w-4" />
        Settings
      </Link>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut} // 4. Use the new handler
        className="text-muted-foreground"
      >
        <LogOut className="h-4 w-4 mr-1" />
        Sign out
      </Button>
    </nav>
  );
}

