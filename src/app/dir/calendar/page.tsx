"use client";

import AppLayout from "@/components/ui/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
export const dynamic = 'force-dynamic';
// Mocking platform info locally
const PLATFORM_INFO: Record<string, { name: string }> = {
  twitter: { name: "X (Twitter)" },
  instagram: { name: "Instagram" },
  tiktok: { name: "TikTok" },
  youtube: { name: "YouTube" },
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  scheduled: "bg-blue-100 text-blue-600 border-blue-200",
  published: "bg-green-100 text-green-600 border-green-200",
  failed: "bg-red-100 text-red-600 border-red-200",
  pending: "bg-blue-100 text-blue-600 border-blue-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const supabase = createClient();
  const now = new Date();
  
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"calendar" | "list">("calendar");
  
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Simulation of fetching data from Supabase
      // Replace with: const { data } = await supabase.from('social_accounts')...
      setTimeout(() => {
        setScheduled([
          { id: '1', postId: '101', scheduledAt: new Date(2026, 4, 25, 14, 0).toISOString(), platforms: ['twitter', 'instagram'], status: 'pending' },
          { id: '2', postId: '102', scheduledAt: new Date(2026, 4, 28, 10, 30).toISOString(), platforms: ['tiktok'], status: 'pending' },
        ]);
        setPosts([
          { id: '101', content: 'Excited to launch omnipost AI! #AI #Marketing', status: 'scheduled', platform: 'twitter', createdAt: new Date().toISOString() },
          { id: '102', content: 'Check out our new dashboard reveal.', status: 'pending', platform: 'tiktok', createdAt: new Date().toISOString() },
        ]);
        setLoading(false);
      }, 800);
    }
    fetchData();
  }, []);

  const handleCancelScheduled = async (id: string) => {
    // Logic to delete from Supabase
    setScheduled(prev => prev.filter(s => s.id !== id));
    console.log(`Unscheduled post ${id}`);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const scheduledByDay: Record<number, any[]> = {};
  scheduled.forEach((s) => {
    const d = new Date(s.scheduledAt);
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
      const day = d.getDate();
      if (!scheduledByDay[day]) scheduledByDay[day] = [];
      scheduledByDay[day].push(s);
    }
  });

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectedDayScheduled = selectedDay ? scheduledByDay[selectedDay] ?? [] : [];

  return (
    <AppLayout title="omnipost AI Calendar">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setActiveTab("calendar")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === "calendar" ? "bg-primary/10 text-primary" : "text-gray-500 hover:text-black"
                )}
              >
                <CalendarIcon className="w-4 h-4 inline mr-2" />
                Calendar
              </button>
              <button
                onClick={() => setActiveTab("list")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === "list" ? "bg-primary/10 text-primary" : "text-gray-500 hover:text-black"
                )}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                All Posts
              </button>
            </div>
          </div>
          <Link href="/chat">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New omnipost
            </Button>
          </Link>
        </div>

        {activeTab === "calendar" ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Calendar grid */}
            <div className="xl:col-span-2 border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
                <h2 className="font-bold text-lg">{monthName}</h2>
                <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-bold text-gray-400 py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
                  const dayScheduled = scheduledByDay[day] ?? [];
                  const isSelected = selectedDay === day;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={cn(
                        "aspect-square rounded-lg p-1 text-sm transition-all relative flex flex-col items-center justify-center",
                        isToday ? "bg-primary text-white font-bold" : isSelected ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "hover:bg-gray-50 text-gray-700",
                        dayScheduled.length > 0 && !isSelected && !isToday && "bg-blue-50"
                      )}
                    >
                      <span>{day}</span>
                      {dayScheduled.length > 0 && (
                        <div className="flex gap-0.5 mt-1">
                          {dayScheduled.slice(0, 3).map((_, idx) => (
                            <div key={idx} className={cn("w-1 h-1 rounded-full", isToday ? "bg-white" : "bg-blue-400")} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day detail panel */}
            <div className="bg-white border rounded-xl p-6 shadow-sm">
              <h3 className="font-bold mb-4">
                {selectedDay
                  ? new Date(viewYear, viewMonth, selectedDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                  : "Select a day"}
              </h3>

              {!selectedDay ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Click a day to see omniposts</p>
                </div>
              ) : selectedDayScheduled.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 mb-4">No posts scheduled</p>
                  <Link href="/chat"><Button size="sm" variant="outline" className="text-xs">Schedule a post</Button></Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayScheduled.map((s) => (
                    <div key={s.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-wrap gap-1">
                          {s.platforms.map((p: string) => (
                            <Badge key={p} className="text-[10px] capitalize bg-blue-100 text-blue-600 border-none">{p}</Badge>
                          ))}
                        </div>
                        {s.status === "pending" && (
                          <button onClick={() => handleCancelScheduled(s.id)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(s.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        <Badge className={cn("text-[10px] ml-auto border-none", STATUS_STYLES[s.status])}>{s.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* List view */
          <div className=" border rounded-xl p-6 shadow-sm">
            <h2 className="font-bold mb-6">All omniposts</h2>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <Sparkles className="w-10 h-10 text-primary/20 mx-auto mb-4" />
                <p className="text-gray-400 mb-6">No posts in your history</p>
                <Link href="/chat"><Button>Generate your first omnipost</Button></Link>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <div key={post.id} className="p-5 rounded-xl bg-gray-50 border border-gray-100 hover:border-primary/30 transition-all">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black line-clamp-2 mb-3">{post.content}</p>
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge className={cn("text-[10px] border-none", STATUS_STYLES[post.status])}>{post.status}</Badge>
                          <Badge className="text-[10px] bg-gray-200 text-gray-600 border-none capitalize">{post.platform}</Badge>
                          <span className="text-xs text-gray-400 ml-auto">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
