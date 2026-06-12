"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Unplug } from "lucide-react";

const PLATFORMS = [
  { id: "x", name: "X (Twitter)", color: "bg-black" },
  { id: "instagram", name: "Instagram", color: "bg-gradient-to-br from-purple-500 to-pink-500" },
  { id: "facebook", name: "Facebook", color: "bg-blue-600" },
  { id: "linkedin", name: "LinkedIn", color: "bg-blue-700" },
  { id: "youtube", name: "YouTube", color: "bg-red-600" },
  { id: "tiktok", name: "TikTok", color: "bg-black" },
  { id: "pinterest", name: "Pinterest", color: "bg-red-600" },
  { id: "snapchat", name: "Snapchat", color: "bg-yellow-400" },
];

interface SocialAccount {
  id: string;
  providerName: string;
  displayName: string | null;
  username: string | null;
}

export function AccountManager() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(data.accounts ?? []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  const connectPlatform = (platformId: string) => {
    window.location.href = `/api/oauth/${platformId}/login`;
  };

  const disconnectPlatform = async (accountId: string) => {
    try {
      await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Manager</CardTitle>
        <CardDescription>
          Connect your social accounts to post directly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {PLATFORMS.map((platform) => {
          const account = accounts.find((a) => a.providerName === platform.id);
          return (
            <div
              key={platform.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded ${platform.color}`}
                  title={platform.name}
                />
                <div>
                  <p className="font-medium text-sm">{platform.name}</p>
                  {account && (
                    <p className="text-xs text-muted-foreground">
                      @{account.username ?? account.displayName ?? "Connected"}
                    </p>
                  )}
                </div>
              </div>
              {account ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnectPlatform(account.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Unplug className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => connectPlatform(platform.id)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Connect
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
