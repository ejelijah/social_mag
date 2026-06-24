"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";    
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronRight,
  LayoutDashboard,
  Link2,
  LogOut,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";

import { Badge } from "./badge";
import { Button } from "./button";
import { Separator } from "./separator";
import { Avatar, AvatarFallback } from "./avatar";
import { ScrollArea } from "./scroll-area";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dir/create", label: "Create Content", icon: Sparkles },
  { href: "/dir/calendar", label: "Content Calendar", icon: Calendar },
  { href: "/dir/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dir/accounts", label: "Connected Accounts", icon: Link2 },
  { href: "/dir/settings", label: "Settings", icon: Settings },
];

function NotificationBell() {
  const supabase = createClient();
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("isRead", false);
    setCount(unreadCount || 0);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("createdAt", { ascending: false })
      .limit(20);
    setNotifications(data || []);
  };

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ isRead: true })
      .eq("isRead", false);
    fetchUnreadCount();
    if (open) fetchNotifications();
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const notifIconMap: Record<string, string> = {
    post_limit_warning: "⚠️",
    payment_failed: "❌",
    subscription_renewed: "✅",
    post_published: "🚀",
    post_failed: "❌",
    welcome: "👋",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full pulse-glow" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-border/50 hover:bg-surface-raised/50 transition-colors",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  <div className="flex gap-3">
                    <span className="text-lg shrink-0">
                      {notifIconMap[n.type] ?? "📢"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);
      
      const { data: sub } = await supabase
        .from("users")
        .select("*")
        .eq("userId", session.user.id)
        .single();
      
      setSubscription(sub);
      setLoading(false);
    };

    getSession();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div className="text-sm text-muted-foreground">Loading your studio...</div>
        </div>
      </div>
    );
  }

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "U";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 shrink-0 flex flex-col glass border-r border-border/60 z-20">
        <div className="px-6 py-5 border-b border-border/60">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* New Purple AI Logo */}
            <img 
              src="/logo.png" 
              alt="OmniPost AI Logo" 
              className="w-8 h-8 rounded-lg glow-primary-sm object-cover" 
            />
            <div>
              <div className="text-sm font-bold gradient-text">OmniPost AI</div>
              <div className="text-xs text-muted-foreground -mt-0.5">Studio</div>
            </div>
          </Link>
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer group",
                      isActive
                        ? "bg-primary/10 text-primary border-r-2 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-raised"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isActive ? "text-primary" : "group-hover:text-foreground"
                      )}
                    />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          <Separator className="my-4 mx-3" />

          {subscription?.plan === "free" && (
            <div className="mx-3 p-4 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Free Plan</span>
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {subscription.postsUsedThisMonth ?? 0}/5 posts used this month
              </div>
              <div className="w-full bg-border rounded-full h-1.5 mb-3">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((subscription.postsUsedThisMonth ?? 0) / 5) * 100)}%`,
                  }}
                />
              </div>
              <Link href="/pricing">
                <Button size="sm" className="w-full text-xs h-7 glow-primary-sm">
                  Upgrade to Pro
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          )}

          {subscription?.plan === "pro" && (
            <div className="mx-3 p-3 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold gradient-text">Pro Plan Active</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Unlimited posts & all platforms</p>
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border/60">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.user_metadata?.full_name || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.is_premium ? "Premium" : "Free plan"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border/60 glass">
          <div>
            {title && (
              <h1 className="text-sm font-semibold text-foreground">{title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          
          {/* Professional Footer for App Approval */}
          <footer className="p-6 border-t border-border/40 mt-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} OmniPost AI. All rights reserved.
              </p>
              <nav className="flex gap-6">
                <Link 
                  href="/policies/privacy.html" 
                  target="_blank" 
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
                <Link 
                  href="/policies/terms.html" 
                  target="_blank" 
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </nav>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
