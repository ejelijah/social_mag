"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AppLayout from "@/components/ui/AppLayout";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Clock,
  FileText,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client"; // Adjust path to your supabase client
export const dynamic = 'force-dynamic';
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  published: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [brand, setBrand] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // 1. Get User/Brand Data from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      // 2. Fetch your posts/stats from Supabase
      const { data: userPosts } = await supabase
        .from("posts")
        .select("*")
        .limit(5)
        .order("createdAt", { ascending: false });

      if (userPosts) setPosts(userPosts);
      setLoading(false);
    }

    fetchData();
  }, []);

  const statsCards = [
    {
      label: "Posts This Month",
      value: posts.length, 
      sub: "Active posts",
      icon: FileText,
      color: "text-primary",
    },
    {
      label: "Scheduled Posts",
      value: 0,
      sub: "pending delivery",
      icon: Clock,
      color: "text-blue-400",
    },
    // ... add other stats here
  ];

  return (
    <AppLayout>
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            Welcome back, Elijah
          </h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Link href="/dir/create">
          <Button className="gap-2 glow-primary-sm">
            <Sparkles className="w-4 h-4" />
            Create Post
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card-premium p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-9 h-9 rounded-lg bg-current/10 flex items-center justify-center", stat.color)}>
                  <Icon className={cn("w-4 h-4", stat.color)} />
                </div>
              </div>
              <div className="text-2xl font-bold mb-0.5">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Posts List */}
        <div className="card-premium p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Recent Drafts</h2>
            <Link href="/dashboard/posts" className="text-xs text-primary flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts found.</p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="p-3 rounded-lg bg-surface-raised border border-border/40">
                  <p className="text-sm line-clamp-1">{post.content}</p>
                  <Badge className={cn("mt-2 text-[10px]", STATUS_COLORS[post.status] || STATUS_COLORS.draft)}>
                    {post.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card-premium p-6">
          <h2 className="font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/create">
              <div className="p-4 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border/60 transition-all text-center group cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs font-medium">Generate Post</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}