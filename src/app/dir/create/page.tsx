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
  Video,
  FileText,
  Facebook,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export const dynamic = 'force-dynamic';

const PLATFORMS = {
  twitter: { name: "Twitter" },
  facebook: { name: "Facebook" },
  instagram: { name: "Instagram" },
  snapchat: { name: "Snapchat" },
  youtube: { name: "YouTube" },
  tiktok: { name: "TikTok" },
};

type Platform = keyof typeof PLATFORMS;

export default function CreateContent() {
  const supabase = createClient();

  const [userName, setUserName] = useState("User");
  const [topic, setTopic] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "multi">("multi");
  const [generateTypes, setGenerateTypes] = useState<string[]>(["text", "image"]); 
  
  const [generatedPost, setGeneratedPost] = useState<{
    id: string | number;
    content: string;
    hashtags: string[];
    imageUrl?: string | null;
    mediaPath?: string;
    mediaType?: 'image' | 'video';
    platform: string;
  } | null>(null);
  
  const [editedContent, setEditedContent] = useState("");
  const [selectedPublishPlatforms, setSelectedPublishPlatforms] = useState<string[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState({
    trending: true,
    generating: false,
    media: false,
    saving: false,
    publishing: false
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('name')
            .eq('id', user.id)
            .single();
          
          if (profile?.name) {
            setUserName(profile.name.split(' ')[0]);
          }
        }

        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('is_connected', true);
        
        if (accounts) setConnectedPlatforms(accounts);

        const { data: trendData, error: trendError } = await supabase.functions.invoke('get-trending');
        if (trendError) throw trendError;
        if (trendData?.topics) setTrending(trendData.topics);

      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setIsLoading(prev => ({ ...prev, trending: false }));
      }
    };
    fetchData();
  }, [supabase]);

  const toggleType = (type: string) => {
    setGenerateTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  async function handleOmniGenerate() {
    if (!topic.trim()) return toast.error("Enter a topic first");
    if (generateTypes.length === 0) return toast.error("Select what to generate (Text/Image/Video)");

    setIsLoading(prev => ({ ...prev, generating: true }));
    let currentPost: any = { id: Date.now(), platform: selectedPlatform, content: "", hashtags: [] };

    try {
      if (generateTypes.includes("text")) {
        const { data, error } = await supabase.functions.invoke('generate-post', {
          body: { topic, platform: selectedPlatform }
        });
        if (error) throw error;
        currentPost = { ...currentPost, ...data };
        setEditedContent(data.content);
      }

      if (generateTypes.includes("image")) {
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: { prompt: topic }
        });
        if (error) throw error;
        currentPost = { ...currentPost, imageUrl: data.url, mediaPath: data.path, mediaType: 'image' };
      }

      if (generateTypes.includes("video")) {
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: { prompt: topic, image_url: currentPost.imageUrl }
        });
        if (error) throw error;
        currentPost = { ...currentPost, imageUrl: data.url, mediaPath: data.path, mediaType: 'video' };
      }

      setGeneratedPost(currentPost);
      toast.success("Omnipost content ready!");
    } catch (e: any) {
      console.error("Generation Error:", e);
      toast.error("Failed to generate content.");
    } finally {
      setIsLoading(prev => ({ ...prev, generating: false }));
    }
  }

  async function handlePublishNow() {
    if (!generatedPost || selectedPublishPlatforms.length === 0) {
      return toast.error("Select platforms and generate content first.");
    }

    setIsLoading(prev => ({ ...prev, publishing: true }));
    
    try {
      const publishPromises = selectedPublishPlatforms.map(async (platform) => {
        const platformKey = platform.toLowerCase();
        const functionName = `post-${platformKey}`;
        
        // Prepare platform-specific body mapping
        const requestBody: any = {
          mediaUrl: generatedPost.imageUrl,
          mediaPath: generatedPost.mediaPath,
        };

        // Custom field mapping based on platform requirements
        if (platformKey === 'facebook') {
          requestBody.message = editedContent;
        } else if (platformKey === 'instagram') {
          requestBody.caption = editedContent;
        } else if (platformKey === 'tiktok') {
          requestBody.description = editedContent;
        } else {
          requestBody.content = editedContent; // Fallback for Twitter/others
        }
        
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: requestBody
        });

        if (error) throw new Error(`${platform}: ${error.message}`);
        return { platform, data };
      });

      const results = await Promise.allSettled(publishPromises);
      
      const failures = results.filter(r => r.status === 'rejected');
      const successes = results.filter(r => r.status === 'fulfilled');

      if (failures.length > 0) {
        failures.forEach((f: any) => toast.error(`Failed to post: ${f.reason}`));
      }

      if (successes.length > 0) {
        toast.success(`Successfully published to ${successes.length} platforms!`);
        setGeneratedPost(null);
        setEditedContent("");
        setTopic("");
      }
    } catch (e: any) {
      console.error("Publishing Error:", e);
      toast.error("An unexpected error occurred during publishing.");
    } finally {
      setIsLoading(prev => ({ ...prev, publishing: false }));
    }
  }


  return (
    <AppLayout title="Create Content">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          <div className="xl:col-span-4 space-y-6">
            <div className="card-premium p-5 space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Platform</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedPlatform("multi")}
                  className={cn("px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all", selectedPlatform === "multi" ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-surface-raised")}
                >
                  Multi-Post
                </button>
                {Object.entries(PLATFORMS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlatform(key as Platform)}
                    className={cn("px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all", selectedPlatform === key ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-surface-raised")}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="card-premium p-5 space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Your Prompt</h3>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What do you want to create?"
                className="min-h-[120px] border-border/50 resize-none text-sm text-white"
              />
              
              <div className="flex gap-2 py-2">
                <button 
                  onClick={() => toggleType("text")}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-[10px] font-bold transition-all", generateTypes.includes("text") ? "bg-primary text-black border-primary" : "border-border/50 text-muted-foreground")}
                >
                  <FileText className="w-3 h-3" /> TEXT
                </button>
                <button 
                  onClick={() => toggleType("image")}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-[10px] font-bold transition-all", generateTypes.includes("image") ? "bg-primary text-black border-primary" : "border-border/50 text-muted-foreground")}
                >
                  <ImageIcon className="w-3 h-3" /> IMAGE
                </button>
                <button 
                  onClick={() => toggleType("video")}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-[10px] font-bold transition-all", generateTypes.includes("video") ? "bg-primary text-black border-primary" : "border-border/50 text-muted-foreground")}
                >
                  <Video className="w-3 h-3" /> VIDEO
                </button>
              </div>

              <Button
                onClick={handleOmniGenerate}
                disabled={isLoading.generating || !topic.trim()}
                className="w-full h-11 bg-primary font-bold rounded-xl text-black"
              >
                {isLoading.generating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                Generate Content
              </Button>
            </div>

            <div className="card-premium p-5 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Trending</h3>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoading.trending ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
                ) : (
                  trending.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTopic(t.topic)}
                      className="w-full text-left p-3 rounded-xl border border-transparent bg-surface-raised/50 hover:border-primary/30 transition-all"
                    >
                      <p className="text-xs font-bold text-foreground line-clamp-1">{t.topic}</p>
                      <span className="text-[10px] text-muted-foreground uppercase">{t.category}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 space-y-6">
            {!generatedPost && !isLoading.generating ? (
              <div className="card-premium h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12 border-dashed border-2 border-border/50">
                <Wand2 className="w-12 h-12 text-primary mb-4 opacity-20" />
                <h2 className="text-xl font-bold mb-2">Ready to create, {userName}?</h2>
                <p className="text-muted-foreground text-sm">Input a prompt and select your content types to begin.</p>
              </div>
            ) : isLoading.generating ? (
              <div className="card-premium h-full min-h-[600px] flex flex-col items-center justify-center p-12">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground animate-pulse text-lg font-bold">Generating your Omnipost...</p>
                <p className="text-xs text-muted-foreground mt-2">Checking Nano Banana & Fal.ai status</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                {generateTypes.includes("text") && (
                  <div className="card-premium p-6 bg-surface-raised/20">
                    <div className="flex items-center justify-between mb-4">
                      <Badge className="bg-primary/10 text-primary px-3 py-1">AI Copy</Badge>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { navigator.clipboard.writeText(editedContent); toast.success("Copied!"); }} className="p-2 hover:bg-surface-raised rounded-lg"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => setGeneratedPost(null)} className="p-2 hover:bg-destructive/10 text-destructive rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="min-h-[150px] text-lg bg-transparent border-none focus-visible:ring-0 resize-none p-0"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card-premium p-6 space-y-4 bg-surface-raised/20">
                    <h3 className="text-sm font-bold uppercase tracking-wider">Visual Preview</h3>
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-border/50 flex items-center justify-center">
                      {generatedPost?.imageUrl ? (
                        generatedPost.mediaType === 'video' ? (
                          <video src={generatedPost.imageUrl} controls autoPlay loop className="w-full h-full object-cover" />
                        ) : (
                          <img src={generatedPost.imageUrl} className="w-full h-full object-cover" alt="AI Generated" />
                        )
                      ) : (
                        <div className="text-center opacity-20">
                          <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-xs">No media generated</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card-premium p-6 flex flex-col bg-surface-raised/20">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4">Publishing</h3>
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {connectedPlatforms.map((acc) => (
                          <button
                            key={acc.platform}
                            onClick={() => {
                              setSelectedPublishPlatforms(prev => 
                                prev.includes(acc.platform) ? prev.filter(x => x !== acc.platform) : [...prev, acc.platform]
                              );
                            }}
                            className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all", selectedPublishPlatforms.includes(acc.platform) ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground")}
                          >
                            {selectedPublishPlatforms.includes(acc.platform) && <Check className="w-3 h-3" />}
                            {acc.platform}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-6">
                      <Button variant="outline" className="h-11 rounded-xl font-bold">
                        <Calendar className="w-4 h-4 mr-2" /> Schedule
                      </Button>
                      <Button onClick={handlePublishNow} disabled={isLoading.publishing || selectedPublishPlatforms.length === 0} className="h-11 rounded-xl font-bold bg-primary text-black">
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