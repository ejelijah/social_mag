"use client";

import AppLayout from "@/components/ui/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  MousePointer,
  Share2,
  TrendingUp,
  Users,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
export const dynamic = 'force-dynamic';
// Define platform info locally since the shared import is missing
const PLATFORM_INFO: Record<string, { name: string }> = {
  twitter: { name: "X (Twitter)" },
  linkedin: { name: "LinkedIn" },
  instagram: { name: "Instagram" },
  snapchat: { name: "Snapchat" },
  youtube: { name: "YouTube" },
  tiktok: { name: "TikTok" },
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#000000",
  linkedin: "#0A66C2",
  instagram: "#E1306C",
  snapchat: "#FFFC00",
  youtube: "#FF0000",
  tiktok: "#000000",
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", color.replace('text-', 'bg-') + '/10')}>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div className="text-2xl font-bold mb-0.5">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="text-xs text-muted-foreground/60 mt-0.5">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-xl p-3 text-xs shadow-xl">
      <p className="font-medium mb-2 text-black">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-medium text-black">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // Mock data placeholders - You can connect these to a real 'analytics' table in Supabase later
  const [stats, setStats] = useState({
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalImpressions: 0,
    totalReach: 0,
    totalClicks: 0,
    connectedAccounts: [] as string[]
  });

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAnalytics() {
      // For now, we simulate a fetch. 
      // Later, you can do: const { data } = await supabase.from('analytics').select('*')
      setTimeout(() => {
        setStats({
          totalLikes: 1240,
          totalComments: 432,
          totalShares: 156,
          totalImpressions: 45200,
          totalReach: 12800,
          totalClicks: 890,
          connectedAccounts: ['twitter', 'instagram']
        });
        
        setChartData([
          { date: "May 10", impressions: 2400, likes: 400, shares: 100 },
          { date: "May 12", impressions: 3200, likes: 520, shares: 120 },
          { date: "May 14", impressions: 2800, likes: 480, shares: 90 },
          { date: "May 16", impressions: 4500, likes: 800, shares: 200 },
          { date: "May 18", impressions: 3900, likes: 650, shares: 150 },
          { date: "May 20", impressions: 5200, likes: 920, shares: 210 },
          { date: "May 22", impressions: 4800, likes: 880, shares: 190 },
        ]);
        
        setLoading(false);
      }, 1000);
    }
    fetchAnalytics();
  }, []);

  const engagementRate = stats.totalImpressions > 0
      ? (((stats.totalLikes + stats.totalComments + stats.totalShares) / stats.totalImpressions) * 100).toFixed(2)
      : "0.00";

  return (
    <AppLayout title="omnipost AI Analytics">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">omnipost AI Insights</h1>
            <p className="text-muted-foreground text-sm">Real-time performance across your omnipost network</p>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <TrendingUp className="w-3 h-3 mr-1" />
            Live from omnipost AI
          </Badge>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Impressions" value={stats.totalImpressions.toLocaleString()} icon={Eye} color="text-blue-500" sub="post views" />
            <StatCard label="Total Reach" value={stats.totalReach.toLocaleString()} icon={Users} color="text-purple-500" sub="unique accounts" />
            <StatCard label="Engagement Rate" value={`${engagementRate}%`} icon={BarChart3} color="text-primary" sub="likes + comments + shares" />
            <StatCard label="Link Clicks" value={stats.totalClicks.toLocaleString()} icon={MousePointer} color="text-green-500" sub="total clicks" />
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Likes" value={stats.totalLikes.toLocaleString()} icon={Heart} color="text-pink-500" />
          <StatCard label="Comments" value={stats.totalComments.toLocaleString()} icon={MessageCircle} color="text-yellow-600" />
          <StatCard label="Shares" value={stats.totalShares.toLocaleString()} icon={Share2} color="text-cyan-500" />
          <StatCard
            label="Connected Platforms"
            value={stats.connectedAccounts.length}
            icon={Users}
            color="text-orange-500"
            sub="active connections"
          />
        </div>

        {/* Impressions timeline */}
        <div className="bg-gray-800 border rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-5 text-black">Growth Timeline (Last 14 days)</h2>
          {loading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No omnipost data yet. Start scheduling to see metrics.
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: '20px' }} />
                <Line type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="likes" stroke="#ec4899" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="shares" stroke="#06b6d4" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Platform Breakdown */}
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-5 text-black">omnipost Platform Performance</h2>
          {loading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                {stats.connectedAccounts.map((platform: string) => {
                  const info = PLATFORM_INFO[platform];
                  const color = PLATFORM_COLORS[platform] || "#888";
                  return (
                    <div key={platform} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div
                        className="w-1.5 h-10 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold capitalize">
                          {info?.name || platform}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Connected via omnipost AI
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">Active</div>
                        <div className="text-xs text-green-600 font-medium">Synced</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="bg-gray-50 rounded-xl p-6 flex flex-col justify-center items-center text-center border border-gray-100">
                <Sparkles className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-bold text-sm mb-1">omnipost AI Prediction</h3>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  Based on your current reach, your engagement is expected to grow by 12% next week.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}