"use client";

import AppLayout from "@/components/ui/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Hash,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { invokeGrok } from "@/app/actions/chat";

const PLATFORM_INFO: Record<string, { name: string }> = {
  twitter: { name: "X (Twitter)" },
  instagram: { name: "Instagram" },
  tiktok: { name: "TikTok" },
  youtube: { name: "YouTube" },
  snapchat: { name: "Snapchat" },
  linkedin: { name: "LinkedIn" },
};

const PLATFORMS = Object.keys(PLATFORM_INFO);

export default function CreateContent() {
  const supabase = createClient();
  
  // UI State
  const [topic, setTopic] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("multi");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<any>(null);
  const [editedContent, setEditedContent] = useState("");
  const [showScheduler, setShowScheduler] = useState(false);
  
  // Scheduling State (America/Halifax context)
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedPublishPlatforms, setSelectedPublishPlatforms] = useState<string[]>([]);

  // Data State
  const [profile, setProfile] = useState<any>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Load Profile & Usage
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(profileData);

      // 2. Load Connected Accounts
      const { data: accounts } = await supabase.from('social_accounts').select('provider').eq('user_id', user.id);
      setConnectedPlatforms(accounts || []);

      // 3. Mock Trending Topics
      setTrending([
        { id: 1, topic: "AI in Marketing", category: "Technology" },
        { id: 2, topic: "omnipost AI Launch", category: "Business" },
        { id: 3, topic: "Summer Content Ideas", category: "Lifestyle" }
      ]);

      setLoadingData(false);
    }
    loadData();
  }, [supabase]);

  const handleGenerate = async () => {
    if (!topic.trim()) return alert("Please enter a topic first.");
    
    setIsGenerating(true);
    try {
      const prompt = `Write a ${selectedPlatform} post about: ${topic}. 
                      Brand Voice: ${profile?.brand_voice || 'professional'}. 
                      Include 3 relevant hashtags at the end.`;
      
      const response = await invokeGrok([{ role: "user", content: prompt }]);
      
      setGeneratedPost({
        content: response,
        platform: selectedPlatform,
        hashtags: response.match(/#\w+/g) || []
      });
      setEditedContent(response);
    } catch (error) {
      alert("omnipost AI: Failed to generate post. Check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledDate || !scheduledTime || selectedPublishPlatforms.length === 0) {
      return alert("Please select date, time, and at least one platform.");
    }

    // Create timestamp in user's local time (America/Halifax)
    const localDateTime = `${scheduledDate}T${scheduledTime}:00`;
    const dueAt = new Date(localDateTime).toISOString();

    alert(`omnipost AI: Post scheduled for ${localDateTime} (Halifax Time)`);
    setShowScheduler(false);
  };

  const togglePublishPlatform = (p: string) => {
    setSelectedPublishPlatforms(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  return (
    <AppLayout title="omnipost AI Studio">
      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Left: Input panel */}
          <div className="xl:col-span-1 space-y-5">
            {/* Usage */}
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase">Usage Status</span>
                <Badge className="bg-primary/10 text-primary border-none">
                  {profile?.is_premium ? "Pro Plan" : "Free Plan"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                {profile?.is_premium ? "Unlimited omniposts active" : "4 / 5 posts used this month"}
              </p>
            </div>

            {/* Platform Selector */}
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <label className="text-xs font-bold text-gray-400 uppercase mb-3 block">Target Platform</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedPlatform("multi")}
                  className={cn(
                    "p-2 rounded-lg border text-xs font-medium transition-all",
                    selectedPlatform === "multi" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 hover:border-primary/40"
                  )}
                >
                  All
                </button>
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={cn(
                      "p-2 rounded-lg border text-xs font-medium transition-all capitalize",
                      selectedPlatform === p ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 hover:border-primary/40"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Input */}
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <label className="text-xs font-bold text-gray-400 uppercase mb-3 block">What's the topic?</label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter your post idea..."
                rows={3}
                className="bg-gray-50 border-gray-200 mb-3"
              />
              <Button onClick={handleGenerate} disabled={isGenerating || !topic.trim()} className="w-full gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Generate omnipost
              </Button>
            </div>

            {/* Trending */}
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <label className="text-xs font-bold text-gray-400 uppercase">Trending Now</label>
              </div>
              <div className="space-y-2">
                {trending.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTopic(t.topic)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all"
                  >
                    <div className="font-bold text-gray-700">{t.topic}</div>
                    <div className="text-[10px] text-gray-400">{t.category}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Generated post panel */}
          <div className="xl:col-span-2 space-y-5">
            {!generatedPost && !isGenerating ? (
              <div className="bg-white border border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">Ready to create?</h3>
                <p className="text-gray-400 text-sm max-w-sm">
                  Enter a topic on the left and omnipost AI will craft the perfect social media content for you.
                </p>
              </div>
            ) : isGenerating ? (
              <div className="bg-white border rounded-xl p-12 flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <p className="text-sm font-medium text-gray-600">omnipost AI is thinking...</p>
              </div>
            ) : (
              <>
                {/* Editor */}
                <div className="bg-white border rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className="bg-primary/10 text-primary border-none capitalize">
                      {generatedPost.platform}
                    </Badge>
                    <div className="flex gap-2">
                      <button onClick={() => {navigator.clipboard.writeText(editedContent); alert("Copied!");}} className="p-2 hover:bg-gray-100 rounded-lg"><Copy className="w-4 h-4 text-gray-400" /></button>
                      <button onClick={() => setGeneratedPost(null)} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                    </div>
                  </div>

                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={6}
                    className="bg-gray-50 border-gray-200 mb-4"
                  />

                  {/* Publish / Schedule Section */}
                  <Separator className="my-6" />
                  <h3 className="font-bold text-sm mb-4">Publish via omnipost AI</h3>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    {connectedPlatforms.length === 0 ? (
                      <p className="text-xs text-gray-400">No accounts connected. <Link href="/accounts" className="text-primary underline">Connect now</Link></p>
                    ) : (
                      connectedPlatforms.map((acc) => (
                        <button
                          key={acc.provider}
                          onClick={() => togglePublishPlatform(acc.provider)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all capitalize",
                            selectedPublishPlatforms.includes(acc.provider) ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500"
                          )}
                        >
                          {acc.provider}
                        </button>
                      ))
                    )}
                  </div>

                  {showScheduler && (
                    <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100 grid grid-cols-2 gap-4">
                      <div className="col-span-2 text-xs font-bold text-gray-400 uppercase">Schedule for (Halifax Time)</div>
                      <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="bg-white" />
                      <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="bg-white" />
                      <Button onClick={handleSchedule} className="col-span-2">Confirm Schedule</Button>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowScheduler(!showScheduler)} className="flex-1 gap-2">
                      <Calendar className="w-4 h-4" /> Schedule
                    </Button>
                    <Button onClick={() => alert("Publishing...")} disabled={selectedPublishPlatforms.length === 0} className="flex-1 gap-2">
                      <Send className="w-4 h-4" /> Publish Now
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}