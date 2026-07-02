"use client";

import AppLayout from "@/components/ui/AppLayout";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Check,
  Link2,
  Loader2,
  Shield,
  Unlink,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";

export const dynamic = 'force-dynamic';

const PLATFORMS = {
  facebook: { name: "Facebook" },
  twitter: { name: "Twitter" },
  instagram: { name: "Instagram" },
  snapchat: { name: "Snapchat" },
  youtube: { name: "YouTube" },
  tiktok: { name: "TikTok" },
};

type Platform = keyof typeof PLATFORMS;

const PLATFORM_ICONS: Record<string, string> = {
  facebook: "f",
  twitter: "𝕏",
  instagram: "📸",
  snapchat: "👻",
  youtube: "▶",
  tiktok: "♪",
};

const PLATFORM_BG: Record<string, string> = {
  facebook: "bg-[#1877F2]",
  twitter: "bg-zinc-900",
  instagram: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
  snapchat: "bg-yellow-400",
  youtube: "bg-red-600",
  tiktok: "bg-zinc-950",
};

export default function AccountsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);

  const supabase = createClient();

  const fetchAccountsData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: accounts, error: accError } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("user_id", user.id);

      if (accError) throw accError;

      const { data: profile, error: profError } = await supabase
        .from("users")
        .select("plan, platform_limit")
        .eq("id", user.id)
        .single();

      if (profError) throw profError;

      setData({
        accounts: accounts || [],
        plan: profile?.plan ?? "free",
        platformLimit: profile?.platform_limit ?? 2,
      });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAccountsData();
  }, [fetchAccountsData]);

  async function handleDisconnect(platform: Platform) {
    setIsActionPending(true);
    try {
      const { error } = await supabase
        .from("social_accounts")
        .update({ is_connected: false })
        .eq("platform", platform);

      if (error) throw error;

      toast.success("Account disconnected");
      await fetchAccountsData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsActionPending(false);
    }
  }

  const platforms = Object.keys(PLATFORMS) as Platform[];
  const connectedAccounts = data?.accounts.filter((a: any) => a.is_connected) ?? [];
  const isPro = data?.plan === "pro";
  const platformLimit = data?.platformLimit ?? 2;

  return (
    <AppLayout title="Connected Accounts">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Connected Accounts</h1>
            <p className="text-muted-foreground text-sm">
              Connect your social platforms to enable one-click publishing
            </p>
          </div>
          <Badge className={cn(
            "px-3 py-1.5",
            isPro
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted text-muted-foreground"
          )}>
            {isPro ? (
              <><Zap className="w-3 h-3 mr-1" /> Pro — All platforms</>
            ) : (
              <><Users className="w-3 h-3 mr-1" /> Free — {connectedAccounts.length}/{platformLimit} platforms</>
            )}
          </Badge>
        </div>

        {!isPro && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Free plan: up to {platformLimit} platforms</p>
                <p className="text-xs text-muted-foreground">
                  Upgrade to Pro to connect all 6 platforms simultaneously
                </p>
              </div>
            </div>
            <Link href="/pricing">
              <Button size="sm" className="shrink-0">
                Upgrade
              </Button>
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platforms.map((p) => (
              <div key={p} className="card-premium p-6 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-surface-raised mb-4" />
                <div className="h-4 bg-surface-raised rounded w-2/3 mb-2" />
                <div className="h-3 bg-surface-raised rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platforms.map((platform) => {
              const info = PLATFORMS[platform];
              const account = data?.accounts.find((a: any) => a.platform === platform);
              const is_connected = account?.is_connected ?? false;
              const isLocked = !isPro && !is_connected && connectedAccounts.length >= platformLimit;

              return (
                <div
                  key={platform}
                  className={cn(
                    "card-premium p-6 transition-all",
                    isLocked && "opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold",
                        PLATFORM_BG[platform]
                      )}
                      style={{ color: platform === "snapchat" ? "#000" : "#fff" }}
                    >
                      {PLATFORM_ICONS[platform]}
                    </div>
                    {is_connected && (
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
                        <Check className="w-2.5 h-2.5 mr-1" />
                        Connected
                      </Badge>
                    )}
                    {isLocked && (
                      <Badge className="bg-muted text-muted-foreground text-[10px]">
                        Locked
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-semibold mb-1">{info.name}</h3>

                  {is_connected ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          @{account?.username || 'Connected'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(platform)}
                        disabled={isActionPending}
                        className="w-full text-xs h-8 text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/40 hover:bg-destructive/5"
                      >
                        {isActionPending ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Unlink className="w-3 h-3 mr-1" />
                        )}
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Not connected</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (isLocked) {
                            toast.error("Upgrade to Pro to connect more platforms");
                            return;
                          }

                          if (platform === "facebook" || platform === "instagram") {
                            router.push("/api/oauth/meta/login");
                          } else {
                            router.push(`/api/oauth/${platform}/login`);
                          }
                        }}
                        disabled={isLocked}
                        className="w-full text-xs h-8 gap-2"
                      >
                        <Link2 className="w-3 h-3" />
                        Connect {info.name}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}


