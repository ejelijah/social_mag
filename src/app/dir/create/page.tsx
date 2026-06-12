"use client";

import AppLayout from "@/components/ui/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// FIX: Using client-side supabase client instead of server
import { createClient } from "@/utils/supabase/client";

const PLATFORMS = {
  twitter: { name: "Twitter" },
  linkedin: { name: "LinkedIn" },
  instagram: { name: "Instagram" },
  snapchat: { name: "Snapchat" },
  youtube: { name: "YouTube" },
  tiktok: { name: "TikTok" },
};

type Platform = keyof typeof PLATFORMS;

export default function CreateContent() {
  const supabase = createClient();
  
  // UI State
  const [topic, setTopic] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "multi">("multi");
  const [selectedTrending, setSelectedTrending] = useState<string | null>(null);
  const [generatedPost, setGeneratedPost] = useState<{
    id: string | number;
    content: string;
    hashtags: string[];
    imageUrl?: string | null;
    imagePrompt?: string | null;
    platform: string;
  } | null>({
    id: 0,
    content: "",
    hashtags: [],
    platform: ""
  });
  const [editedContent, setEditedContent] = useState("");
  const [selectedPublishPlatforms, setSelectedPublishPlatforms] = useState<string[]>([]);
  const [showScheduler, setShowScheduler] = useState(false);

  // Data State
  const [trending, setTrending] = useState<any[]>([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState({
    trending: true,
    generating: false,
    image: false,
    saving: false,
    publishing: false
  });

  // Fetch Grok Trending Topics & Social Accounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Social Accounts from Supabase
        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('isConnected', true);
        
        if (accounts) setConnectedPlatforms(accounts);

        // 2. Fetch Trending Topics from Grok (xAI)
        const grokResponse = await fetch("https://api.x./v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "grok-beta",
            messages: [
              { role: "system", content: "Return a JSON array of 5 current trending social media topics. Format: [{id: 1, topic: 'Topic Name', category: 'Category'}]" },
              { role: "user", content: "What is trending right now?" }
            ],
            response_format: { type: "json_object" }
          }),
        });

        const grokData = await grokResponse.json();
        // Assuming Grok returns the array in a field called 'topics'
        const topics = JSON.parse(grokData.choices[0].message.content).topics || [];
        setTrending(topics);
      } catch (error) {
        console.error("Fetch error:", error);
        toast.error("Failed to load trending topics");
      } finally {
        setIsLoading(prev => ({ ...prev, trending: false }));
      }
    };

    fetchData();
  }, []);

  // Handlers
  async function handleGenerate() {
    if (!topic.trim()) return toast.error("Enter a topic first");
    setIsLoading(prev => ({ ...prev, generating: true }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-post', {
        body: { 
          topic: selectedTrending ? `${topic} (trending: ${selectedTrending})` : topic,
          platform: selectedPlatform 
        }
      });

      if (error) throw error;

      setGeneratedPost(data);
      setEditedContent(data.content);
      toast.success("Post generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate post");
    } finally {
      setIsLoading(prev => ({ ...prev, generating: false }));
    }
  }

  async function handleGenerateImage() {
    if (!generatedPost) return;
    setIsLoading(prev => ({ ...prev, image: true }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { 
          postId: generatedPost.id,
          prompt: generatedPost.imagePrompt ?? `Visual for: ${generatedPost.content.slice(0, 100)}`
        }
      });

      if (error) throw error;
      setGeneratedPost(p => p ? { ...p, imageUrl: data.imageUrl } : p);
      toast.success("Image generated!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoading(prev => ({ ...prev, image: false }));
    }
  }

  async function handleSaveEdit() {
    if (!generatedPost) return;
    setIsLoading(prev => ({ ...prev, saving: true }));

    const { error } = await supabase
      .from('posts')
      .update({ content: editedContent })
      .eq('id', generatedPost.id);

    if (!error) {
      setGeneratedPost(p => p ? { ...p, content: editedContent } : p);
      toast.success("Post saved");
    } else {
      toast.error("Failed to save");
    }
    setIsLoading(prev => ({ ...prev, saving: false }));
  }

  async function handlePublishNow() {
    if (!generatedPost || selectedPublishPlatforms.length === 0) return;
    setIsLoading(prev => ({ ...prev, publishing: true }));

    const { data, error } = await supabase.functions.invoke('publish-post', {
      body: { postId: generatedPost.id, platforms: selectedPublishPlatforms }
    });

    if (!error) {
      toast.success(`Published to ${selectedPublishPlatforms.join(", ")}!`);
    } else {
      toast.error("Publishing failed");
    }
    setIsLoading(prev => ({ ...prev, publishing: false }));
  }

  async function handleDelete() {
    if (!generatedPost) return;
    const { error } = await supabase.from('posts').delete().eq('id', generatedPost.id);
    if (!error) {
      setGeneratedPost(null);
      setEditedContent("");
      toast.success("Post deleted");
    }
  }

  function togglePublishPlatform(p: string) {
    setSelectedPublishPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  const charCount = editedContent.length;
  const platformLimit = selectedPlatform === "twitter" ? 280 : selectedPlatform === "multi" ? 500 : 2200;

  return (
    <AppLayout title="Create Content">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Left Column: Configuration */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Platform Selection */}
            <div className="card-premium p-5 space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Target Platform</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedPlatform("multi")}
                  className={cn("px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all", selectedPlatform === "multi" ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "border-border/50 text-muted-foreground hover:bg-surface-raised")}
                >
                  Multi-Post
                </button>
                {Object.entries(PLATFORMS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlatform(key as Platform)}
                    className={cn("px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all", selectedPlatform === key ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "border-border/50 text-muted-foreground hover:bg-surface-raised")}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Input */}
            <div className="card-premium p-5 space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">What's the topic?</h3>
              <Textarea
  value={topic}
  onChange={(e) => setTopic(e.target.value)}
  placeholder="Describe your post idea..."
  className="min-h-[120px] border-border/50 resize-none text-sm text-white"
/>
              <Button
                onClick={handleGenerate}
                disabled={isLoading.generating || !topic.trim()}
                className="w-full h-11 bg-primary hover:bg-primary/90 font-bold rounded-xl glow-primary-sm"
              >
                {isLoading.generating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                {isLoading.generating ? "Generating..." : "Generate Post"}
              </Button>
            </div>

            {/* Trending Section (Powered by Grok) */}
            <div className="card-premium p-5 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Trending (Grok AI)</h3>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoading.trending ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl bg-surface-raised" />)
                ) : (
                  trending.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTrending(t.topic === selectedTrending ? null : t.topic);
                        if (!topic) setTopic(t.topic);
                      }}
                      className={cn("w-full text-left p-3 rounded-xl border transition-all group", selectedTrending === t.topic ? "border-primary/40 bg-primary/5" : "border-transparent bg-surface-raised/50 hover:bg-surface-raised")}
                    >
                      <p className="text-xs font-bold text-foreground group-hover:text-primary">{t.topic}</p>
                      <span className="text-[10px] text-muted-foreground uppercase">{t.category || "General"}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Output */}
          <div className="xl:col-span-8 space-y-6">
            {!generatedPost?.content && !isLoading.generating ? (
              <div className="card-premium h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12 border-dashed border-2 border-border/50">
                <div className="relative w-20 h-20 bg-surface-raised rounded-3xl flex items-center justify-center shadow-2xl mb-6">
                  <Wand2 className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Ready to create?</h2>
                <p className="text-muted-foreground max-w-md">The trending topics are live from Grok. Pick one or type your own to start.</p>
              </div>
            ) : isLoading.generating ? (
              <div className="card-premium h-full min-h-[600px] flex flex-col items-center justify-center p-12">
                <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
                <h3 className="text-xl font-bold mb-2">Analyzing Trends...</h3>
                <p className="text-muted-foreground animate-pulse">Applying your unique brand voice</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Editor Card */}
                <div className="card-premium p-6 bg-surface-raised/20">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      {generatedPost && <Badge className="bg-primary/10 text-primary border-none font-bold px-3 py-1 capitalize">{generatedPost.platform}</Badge>}
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                        <Check className="w-3 h-3" /> AI OPTIMIZED
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { navigator.clipboard.writeText(editedContent); toast.success("Copied!"); }} className="p-2.5 rounded-xl hover:bg-surface-raised text-muted-foreground"><Copy className="w-4 h-4" /></button>
                      <button onClick={handleGenerate} className="p-2.5 rounded-xl hover:bg-surface-raised text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
                      <button onClick={handleDelete} className="p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="min-h-[200px] text-lg bg-transparent border-none focus-visible:ring-0 resize-none p-0 font-medium"
                  />

                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-border/50">
                    <span className={cn("text-xs font-bold", charCount > platformLimit ? "text-destructive" : "text-muted-foreground")}>
                      {charCount} <span className="opacity-50">/ {platformLimit} chars</span>
                    </span>
                    <div className="flex gap-2">
                      {generatedPost && editedContent !== generatedPost.content && (
                        <Button variant="ghost" size="sm" onClick={handleSaveEdit} disabled={isLoading.saving} className="h-8 text-xs font-bold text-primary">
                          {isLoading.saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Changes"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Visuals Card */}
                  <div className="card-premium p-6 space-y-4 bg-surface-raised/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Visual Content</h3>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleGenerateImage} disabled={isLoading.image} className="h-8 text-[10px] font-bold">
                        {isLoading.image ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
                        {generatedPost?.imageUrl ? "REGENERATE" : "CREATE IMAGE"}
                      </Button>
                    </div>
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-surface-raised border border-border/50">
                      {generatedPost?.imageUrl ? (
                        <img src={generatedPost.imageUrl} className="w-full h-full object-cover" alt="AI Generated" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40">
                          <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                          <p className="text-xs font-medium italic">No media attached</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Publishing Card */}
                  <div className="card-premium p-6 flex flex-col bg-surface-raised/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Send className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-bold uppercase tracking-wider">Publishing</h3>
                    </div>
                    <div className="flex-1 space-y-4">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Accounts</p>
                      <div className="flex flex-wrap gap-2">
                        {connectedPlatforms.map((acc) => (
                          <button
                            key={acc.platform}
                            onClick={() => togglePublishPlatform(acc.platform)}
                            className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all", selectedPublishPlatforms.includes(acc.platform) ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-surface-raised")}
                          >
                            {selectedPublishPlatforms.includes(acc.platform) && <Check className="w-3 h-3" />}
                            {PLATFORMS[acc.platform as Platform]?.name || acc.platform}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-6">
                      <Button variant="outline" onClick={() => setShowScheduler(!showScheduler)} className="h-11 rounded-xl font-bold">
                        <Calendar className="w-4 h-4 mr-2" /> Schedule
                      </Button>
                      <Button onClick={handlePublishNow} disabled={isLoading.publishing || selectedPublishPlatforms.length === 0} className="h-11 rounded-xl font-bold bg-primary glow-primary-sm">
                        {isLoading.publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Publish Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}