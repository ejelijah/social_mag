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
  CheckCircle2,
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
  Plus,
  Upload,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core State
  const [userName, setUserName] = useState("User");
  const [topic, setTopic] = useState(""); // This is the user's input text (for AI or Manual)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "multi">("multi");
  const [generateTypes, setGenerateTypes] = useState<string[]>(["text", "image"]); 
  
  // State for manual uploads before they are "pushed" to a post
  const [manualMedia, setManualMedia] = useState<{
    url: string;
    path: string;
    type: 'image' | 'video';
  } | null>(null);

  // The final post object (ready to be published)
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
  const [isPublishedSuccessfully, setIsPublishedSuccessfully] = useState(false);

  const [isLoading, setIsLoading] = useState({
    trending: true,
    generating: false,
    publishing: false,
    uploading: false
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
            .maybeSingle();
          
          if (profile?.name) setUserName(profile.name.split(' ')[0]);
        }

        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('is_connected', true);
        
        if (accounts) setConnectedPlatforms(accounts);

        const { data: trendData } = await supabase.functions.invoke('get-trending');
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

  // FIX: Unified File Upload for all formats
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return toast.error("Please upload a valid image or video file.");
    }

    setIsLoading(prev => ({ ...prev, uploading: true }));
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `manual_uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('content')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('content')
        .getPublicUrl(filePath);

      setManualMedia({
        url: publicUrl,
        path: filePath,
        type: isVideo ? 'video' : 'image'
      });
      
      toast.success(`${isVideo ? 'Video' : 'Image'} uploaded and ready!`);
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setIsLoading(prev => ({ ...prev, uploading: false }));
    }
  };

  // FIX: Manual Logic - Transfers current text and uploaded media to the preview
  const handleManualPost = () => {
    if (!topic.trim() && !manualMedia) {
      return toast.error("Please enter some text or upload media to create a post.");
    }

    const manualPost = {
      id: Date.now(),
      platform: selectedPlatform,
      content: topic,
      hashtags: [],
      imageUrl: manualMedia?.url || null,
      mediaPath: manualMedia?.path || undefined,
      mediaType: manualMedia?.type || undefined,
    };

    setGeneratedPost(manualPost);
    setEditedContent(topic);
    setIsPublishedSuccessfully(false);
    toast.success("Manual post prepared!");
  };

  // AI Generation Path
  async function handleOmniGenerate() {
    if (!topic.trim()) return toast.error("Enter a prompt first");
    
    setIsLoading(prev => ({ ...prev, generating: true }));
    setIsPublishedSuccessfully(false);
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
      toast.success("AI Content Generated!");
    } catch (e: any) {
      console.error("Generation Error:", e);
      toast.error("Failed to generate content.");
    } finally {
      setIsLoading(prev => ({ ...prev, generating: false }));
    }
  }

  async function handlePublishNow() {
    if (!generatedPost || selectedPublishPlatforms.length === 0) {
      return toast.error("Select platforms and prepare content first.");
    }

    setIsLoading(prev => ({ ...prev, publishing: true }));
    
    try {
      const publishPromises = selectedPublishPlatforms.map(async (platform) => {
        const platformKey = platform.toLowerCase();
        const functionName = `post-${platformKey}`;
        
        const requestBody: any = {
          mediaUrl: generatedPost.imageUrl,
          mediaPath: generatedPost.mediaPath,
        };

        if (platformKey === 'facebook') {
          requestBody.message = editedContent;
          requestBody.link = generatedPost.imageUrl;
        } else if (platformKey === 'instagram') {
          requestBody.caption = editedContent;
        } else if (platformKey === 'tiktok') {
          requestBody.description = editedContent;
        } else {
          requestBody.content = editedContent;
        }
        
        const { error } = await supabase.functions.invoke(functionName, {
          body: requestBody
        });

        if (error) throw new Error(`${platform}: ${error.message}`);
        return { platform };
      });

      const results = await Promise.allSettled(publishPromises);
      const successes = results.filter(r => r.status === 'fulfilled');

      if (successes.length > 0) {
        toast.success(`Published to ${successes.length} platforms!`);
        setIsPublishedSuccessfully(true);
        setGeneratedPost(null);
        setManualMedia(null);
        setEditedContent("");
        setTopic("");
      }
    } catch (e: any) {
      toast.error("An unexpected error occurred during publishing.");
    } finally {
      setIsLoading(prev => ({ ...prev, publishing: false }));
    }
  }

  const resetForm = () => {
    setIsPublishedSuccessfully(false);
    setGeneratedPost(null);
    setManualMedia(null);
    setTopic("");
    setEditedContent("");
  };

  return (
    <AppLayout title="Create Content">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Left Column: Controls */}
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
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Post Content</h3>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Write your post or enter an AI prompt..."
                className="min-h-[120px] border-border/50 resize-none text-sm text-white"
              />
              
              <div className="space-y-4">
                {/* AI Generation Options */}
                <div className="flex gap-2">
                  <button onClick={() => toggleType("text")} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-[10px] font-bold transition-all", generateTypes.includes("text") ? "bg-primary text-black border-primary" : "border-border/50 text-muted-foreground")}>
                    <FileText className="w-3 h-3" /> AI TEXT
                  </button>
                  <button onClick={() => toggleType("image")} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-[10px] font-bold transition-all", generateTypes.includes("image") ? "bg-primary text-black border-primary" : "border-border/50 text-muted-foreground")}>
                    <ImageIcon className="w-3 h-3" /> AI IMAGE
                  </button>
                  <button onClick={() => toggleType("video")} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-[10px] font-bold transition-all", generateTypes.includes("video") ? "bg-primary text-black border-primary" : "border-border/50 text-muted-foreground")}>
                    <Video className="w-3 h-3" /> AI VIDEO
                  </button>
                </div>

                {/* Manual Upload Logic */}
                <div className="p-4 border border-dashed border-border/50 rounded-xl bg-surface-raised/30">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3 text-center">Manual Media Upload</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    hidden 
                    accept="image/*,video/*" 
                    onChange={handleFileUpload} 
                  />
                  <Button 
                    variant="outline" 
                    className="w-full h-10 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading.uploading}
                  >
                    {isLoading.uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    {manualMedia ? "Change Media" : "Upload Image/Video"}
                  </Button>
                  {manualMedia && (
                    <p className="text-[10px] text-primary mt-2 text-center font-bold">
                      ✓ {manualMedia.type.toUpperCase()} READY
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleOmniGenerate}
                    disabled={isLoading.generating || !topic.trim()}
                    className="flex-1 h-12 bg-primary font-bold rounded-xl text-black"
                  >
                    {isLoading.generating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                    AI Generate
                  </Button>
                  <Button
                    onClick={handleManualPost}
                    variant="secondary"
                    className="flex-1 h-12 font-bold rounded-xl border border-border"
                  >
                    Use Manual
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Preview & Publish */}
          <div className="xl:col-span-8 space-y-6">
            {isPublishedSuccessfully ? (
              <div className="card-premium h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Post Published!</h2>
                <Button onClick={resetForm} className="h-12 px-8 rounded-xl font-bold bg-primary text-black">
                  <Plus className="w-5 h-5 mr-2" /> Create Another Post
                </Button>
              </div>
            ) : !generatedPost && !isLoading.generating ? (
              <div className="card-premium h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12 border-dashed border-2 border-border/50">
                <Wand2 className="w-12 h-12 text-primary mb-4 opacity-20" />
                <h2 className="text-xl font-bold mb-2">Ready to create, {userName}?</h2>
                <p className="text-muted-foreground text-sm">Use AI or Manual mode to prepare your post for social media.</p>
              </div>
            ) : isLoading.generating ? (
              <div className="card-premium h-full min-h-[600px] flex flex-col items-center justify-center p-12">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground animate-pulse text-lg font-bold">Generating content...</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="card-premium p-6 bg-surface-raised/20">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className="bg-primary/10 text-primary px-3 py-1">Final Content</Badge>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card-premium p-6 space-y-4 bg-surface-raised/20">
                    <h3 className="text-sm font-bold uppercase tracking-wider">Media Preview</h3>
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-border/50 flex items-center justify-center">
                      {generatedPost?.imageUrl ? (
                        generatedPost.mediaType === 'video' ? (
                          <video src={generatedPost.imageUrl} controls autoPlay loop className="w-full h-full object-cover" />
                        ) : (
                          <img src={generatedPost.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                        )
                      ) : (
                        <div className="text-center opacity-20">
                          <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-xs">No media attached</p>
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

