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
  Send,
  Sparkles,
  TrendingUp,
  Trash2,
  Wand2,
  Video,
  FileText,
  Plus,
  Upload,
  User,
  Settings2
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

  // UI & User State
  const [activeMode, setActiveMode] = useState<'ai' | 'manual'>('ai');
  const [userName, setUserName] = useState("Elijah ej");
  
  // Input States
  const [aiPrompt, setAiPrompt] = useState("");
  const [generateTypes, setGenerateTypes] = useState<string[]>(["text", "image"]); 
  const [manualText, setManualText] = useState("");
  const [manualMedia, setManualMedia] = useState<{
    url: string;
    path: string;
    type: 'image' | 'video';
  } | null>(null);

  // Final Content State
  const [generatedPost, setGeneratedPost] = useState<any>(null);
  const [editedContent, setEditedContent] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | "multi">("multi");
  const [selectedPublishPlatforms, setSelectedPublishPlatforms] = useState<string[]>([]);
  
  // Data States
  const [trending, setTrending] = useState<any[]>([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState({
    trending: true,
    generating: false,
    publishing: false,
    uploading: false
  });

  const [isPublishedSuccessfully, setIsPublishedSuccessfully] = useState(false);

  // 1. Fetch User Profile and Connected Accounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Fetching your name from the 'name' column in 'public.users'
          const { data: profile } = await supabase
            .from('users')
            .select('name')
            .eq('id', user.id)
            .single();
          
          if (profile?.name) setUserName(profile.name);
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

  // 2. Handle Manual File Upload (to post-media bucket)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(prev => ({ ...prev, uploading: true }));
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `temp/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(filePath);

      setManualMedia({
        url: publicUrl,
        path: filePath,
        type: file.type.startsWith('video/') ? 'video' : 'image'
      });
      
      toast.success("Media uploaded successfully!");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setIsLoading(prev => ({ ...prev, uploading: false }));
    }
  };

  // 3. AI Generation Path
  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return toast.error("Enter a prompt first");
    setIsLoading(prev => ({ ...prev, generating: true }));
    setIsPublishedSuccessfully(false);
    
    try {
      let currentPost: any = { id: Date.now(), platform: selectedPlatform };

      if (generateTypes.includes("text")) {
        const { data } = await supabase.functions.invoke('generate-post', {
          body: { topic: aiPrompt, platform: selectedPlatform }
        });
        currentPost.content = data.content;
        setEditedContent(data.content);
      }

      if (generateTypes.includes("image")) {
        const { data } = await supabase.functions.invoke('generate-image', { body: { prompt: aiPrompt } });
        currentPost.imageUrl = data.url;
        currentPost.mediaPath = data.path;
        currentPost.mediaType = 'image';
      }

      setGeneratedPost(currentPost);
      toast.success("AI Content Generated!");
    } catch (e: any) {
      toast.error("Generation failed.");
    } finally {
      setIsLoading(prev => ({ ...prev, generating: false }));
    }
  }

  // 4. Manual Preparation Path
  const handleManualPrepare = () => {
    if (!manualText.trim() && !manualMedia) return toast.error("Add text or media first");
    
    setGeneratedPost({
      id: Date.now(),
      content: manualText,
      imageUrl: manualMedia?.url,
      mediaPath: manualMedia?.path,
      mediaType: manualMedia?.type
    });
    setEditedContent(manualText);
    toast.success("Manual content ready!");
  };

  // 5. Final Publishing and Cleanup
  async function handlePublishNow() {
    if (!generatedPost || selectedPublishPlatforms.length === 0) return toast.error("Select platforms first.");
    
    setIsLoading(prev => ({ ...prev, publishing: true }));
    const cleanupPath = generatedPost.mediaPath;
  
    try {
      for (const platform of selectedPublishPlatforms) {
        const platformKey = platform.toLowerCase();
        
        const requestBody = { 
          message: editedContent, 
          link: generatedPost.imageUrl, 
          mediaPath: generatedPost.mediaPath 
        };
        
        // We use 'invoke' but must handle the response body for errors
        const { data, error } = await supabase.functions.invoke(`post-${platformKey}`, { 
          body: requestBody 
        });
  
        // If Supabase returns an error, it's usually in the 'error' object
        if (error) {
          const errorDetails = await error.context.json();
          throw new Error(`${platform}: ${errorDetails.error || error.message}`);
        }
        
        console.log(`${platform} success:`, data);
      }
  
      toast.success("Successfully published to all selected platforms!");
      setIsPublishedSuccessfully(true);
      resetForm();
  
    } catch (e: any) {
      console.error("Publish Error:", e);
      // This will now show the ACTUAL message from the Edge Function
      toast.error(e.message || "An unknown error occurred");
    } finally {
      setIsLoading(prev => ({ ...prev, publishing: false }));
    }
  }
  
  

  const resetForm = () => {
    setGeneratedPost(null);
    setManualMedia(null);
    setManualText("");
    setAiPrompt("");
    setEditedContent("");
  };

  return (
    <AppLayout title="Create Content">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Left Column: Input Panel */}
          <div className="xl:col-span-5 space-y-6">
            <div className="card-premium overflow-hidden border-primary/20">
              <div className="flex border-b border-border/50">
                <button 
                  onClick={() => setActiveMode('ai')}
                  className={cn("flex-1 py-4 flex items-center justify-center gap-2 font-bold text-xs transition-all", activeMode === 'ai' ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:bg-surface-raised")}
                >
                  <Sparkles className="w-4 h-4" /> AI GENERATOR
                </button>
                <button 
                  onClick={() => setActiveMode('manual')}
                  className={cn("flex-1 py-4 flex items-center justify-center gap-2 font-bold text-xs transition-all", activeMode === 'manual' ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:bg-surface-raised")}
                >
                  <User className="w-4 h-4" /> MANUAL UPLOAD
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                    Posting as: <span className="text-primary">{userName}</span>
                  </p>
                </div>

                {activeMode === 'ai' ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <Textarea 
                      value={aiPrompt} 
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="What should the AI create for you?"
                      className="min-h-[120px] bg-surface-raised/30 border-border/50 focus:border-primary/50 bg-black/5"
                    />
                    <div className="flex gap-2">
                      {['text', 'image', 'video'].map(type => (
                        <button key={type} onClick={() => setGenerateTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])} className={cn("flex-1 py-2 rounded-lg border text-[10px] font-bold", generateTypes.includes(type) ? "bg-primary text-black border-primary" : "border-border/50 text-muted-foreground")}>
                          {type.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <Button onClick={handleAiGenerate} disabled={isLoading.generating || !aiPrompt} className="w-full h-12 bg-primary text-black font-bold rounded-xl shadow-lg shadow-primary/20">
                      {isLoading.generating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 w-4 h-4" />}
                      Generate AI Post
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <Textarea 
                      value={manualText} 
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Type your post content here..."
                      className="min-h-[120px] bg-surface-raised/30 border-border/50 focus:border-primary/50 bg-black/5"
                    />
                    <div className="p-4 border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center gap-3 ">
                      <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" onChange={handleFileUpload} />
                      {manualMedia ? (
                        <div className="text-center">
                          <p className="text-xs font-bold text-primary mb-2">✓ {manualMedia.type.toUpperCase()} READY</p>
                          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Change File</Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground opacity-30" />
                          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading.uploading}>
                            {isLoading.uploading ? <Loader2 className="animate-spin mr-2" /> : "Upload Image or Video"}
                          </Button>
                        </>
                      )}
                    </div>
                    <Button onClick={handleManualPrepare} className="w-full h-12 bg-white text-black font-bold rounded-xl border border-border">
                      Prepare Manual Post
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="card-premium p-5 space-y-4">
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /><h3 className="text-xs font-bold uppercase tracking-widest">Trending Ideas</h3></div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoading.trending ? <Skeleton className="h-20 w-full rounded-xl" /> : trending.map((t, i) => (
                  <button key={i} onClick={() => activeMode === 'ai' ? setAiPrompt(t.topic) : setManualText(t.topic)} className="w-full text-left p-3 rounded-xl bg-surface-raised/50 hover:border-primary/30 border border-transparent transition-all">
                    <p className="text-xs font-bold truncate">{t.topic}</p>
                    <span className="text-[9px] text-muted-foreground uppercase">{t.category}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Preview Panel */}
          <div className="xl:col-span-7 space-y-6">
            {isPublishedSuccessfully ? (
              <div className="card-premium h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12">
                <CheckCircle2 className="w-16 h-16 text-primary mb-4" />
                <h2 className="text-2xl font-bold">Post Published!</h2>
                <p className="text-muted-foreground text-sm mt-2">Media has been cleared from storage.</p>
                <Button onClick={() => setIsPublishedSuccessfully(false)} className="mt-6 bg-primary text-black px-8">Create Another</Button>
              </div>
            ) : !generatedPost && !isLoading.generating ? (
              <div className="card-premium h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 border-dashed border-2 border-border/50">
                <Settings2 className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <h2 className="text-xl font-bold opacity-50">Content Preview</h2>
                <p className="text-muted-foreground text-sm">Your post will appear here once prepared.</p>
              </div>
            ) : isLoading.generating ? (
              <div className="card-premium h-full min-h-[500px] flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="font-bold animate-pulse">AI is working its magic...</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="card-premium p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <Badge className="bg-primary/10 text-primary px-3 py-1">Review Content</Badge>
                    <Trash2 onClick={resetForm} className="w-4 h-4 text-destructive cursor-pointer hover:scale-110 transition-transform" />
                  </div>
                  <Textarea 
                    value={editedContent} 
                    onChange={(e) => setEditedContent(e.target.value)} 
                    className="min-h-[150px] text-lg bg-transparent border-none focus-visible:ring-0 p-0 resize-none" 
                  />
                  <div className="aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-border/50">
                    {generatedPost?.imageUrl ? (
                      generatedPost.mediaType === 'video' ? 
                        <video src={generatedPost.imageUrl} controls className="w-full h-full object-contain" /> : 
                        <img src={generatedPost.imageUrl} className="w-full h-full object-contain" alt="Preview" />
                    ) : <ImageIcon className="w-12 h-12 opacity-10" />}
                  </div>
                </div>

                <div className="card-premium p-6 space-y-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest">Select Destinations</h3>
                  <div className="flex flex-wrap gap-2">
                    {connectedPlatforms.map(acc => (
                      <button 
                        key={acc.platform} 
                        onClick={() => setSelectedPublishPlatforms(prev => prev.includes(acc.platform) ? prev.filter(x => x !== acc.platform) : [...prev, acc.platform])} 
                        className={cn("px-4 py-2 rounded-xl border text-xs font-bold transition-all", selectedPublishPlatforms.includes(acc.platform) ? "bg-primary text-black border-primary" : "border-border text-muted-foreground")}
                      >
                        {acc.platform}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="h-12 rounded-xl border-border/50">Schedule</Button>
                    <Button 
                      onClick={handlePublishNow} 
                      disabled={isLoading.publishing || selectedPublishPlatforms.length === 0} 
                      className="h-12 bg-primary text-black font-bold rounded-xl"
                    >
                      {isLoading.publishing ? <Loader2 className="animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Publish Now</>}
                    </Button>
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



