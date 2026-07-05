"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Sparkles, Image as ImageIcon, Loader2, Send } from "lucide-react";

const TEXT_MODELS = [
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq (Llama)" },
  { value: "mistral", label: "Mistral" },
];

const IMAGE_MODELS = [
  { value: "pollinations", label: "Pollinations (Free)" },
  { value: "huggingface", label: "Hugging Face" },
];

const PLATFORMS = [
  { value: "x", label: "X (Twitter)" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "pinterest", label: "Pinterest" },
];

type ScheduledRow = {
  id: string;
  platforms: string[];
  content: { text: string; imageUrl?: string };
  scheduled_at: string;
  status: string;
  createdAt?: string | null;
};

export function ContentGenerator() {
  const supabase = createClient();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState<"text" | "image">("text");
  const [textModel, setTextModel] = useState("gemini");
  const [imageModel, setImageModel] = useState("pollinations");
  const [generatedText, setGeneratedText] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postResult, setPostResult] = useState<Record<string, { id?: string; error?: string }> | null>(
    null
  );

  const [scheduledPosts, setScheduledPosts] = useState<ScheduledRow[]>([]);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  const loadScheduledPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduled-posts");
      const data = await res.json();
      if (res.ok && Array.isArray(data.scheduled_posts)) {
        setScheduledPosts(data.scheduled_posts);
      }
    } catch {
      setScheduledPosts([]);
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      setUser(u);
      setAuthLoading(false);
      if (u) await loadScheduledPosts();
    };
    checkUser();
  }, [supabase, loadScheduledPosts]);

  const contentPayload = () => {
    const text =
      generatedText.trim() ||
      (generatedImage ? "Photo post" : "");
    return {
      text,
      ...(generatedImage ? { imageUrl: generatedImage } : {}),
    };
  };

  const hasPublishableContent = () =>
    Boolean(generatedText.trim() || generatedImage);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setPostResult(null);
    setScheduleNotice(null);
    try {
      if (contentType === "text") {
        const res = await fetch("/api/generate/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, model: textModel }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Generation failed");
        setGeneratedText(data.result);
        setGeneratedImage("");
      } else {
        const res = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, model: imageModel }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Generation failed");
        setGeneratedImage(data.result);
        setGeneratedText("");
      }
    } catch (err) {
      setGeneratedText(err instanceof Error ? err.message : "Generation failed");
      setGeneratedImage("");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = async () => {
    if (!selectedPlatforms.length || !hasPublishableContent()) return;
    setIsPosting(true);
    setPostResult(null);
    try {
      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          content: contentPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Post failed");
      setPostResult(data.results);
    } catch (err) {
      setPostResult({ _error: { error: err instanceof Error ? err.message : "Post failed" } });
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedPlatforms.length || !hasPublishableContent()) return;
    if (!scheduledLocal) {
      setScheduleNotice("Pick a date and time first.");
      return;
    }
    const when = new Date(scheduledLocal);
    if (Number.isNaN(when.getTime())) {
      setScheduleNotice("Invalid date.");
      return;
    }
    setIsScheduling(true);
    setScheduleNotice(null);
    try {
      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          content: contentPayload(),
          scheduled_at: when.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Schedule failed");
      setScheduleNotice(`Scheduled for ${format(when, "PPpp")}`);
      await loadScheduledPosts();
    } catch (err) {
      setScheduleNotice(err instanceof Error ? err.message : "Schedule failed");
    } finally {
      setIsScheduling(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  if (authLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Sign in to use the content generator
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Content Generator
        </CardTitle>
        <CardDescription>
          Generate content, post immediately, or save a row in scheduled_posts for later publishing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Content type</Label>
          <div className="flex gap-4">
            <Button
              variant={contentType === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => setContentType("text")}
            >
              Text
            </Button>
            <Button
              variant={contentType === "image" ? "default" : "outline"}
              size="sm"
              onClick={() => setContentType("image")}
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              Image
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            placeholder="e.g., Write a catchy caption for a coffee shop promoting their new seasonal latte..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>AI Model</Label>
          <Select
            value={contentType === "text" ? textModel : imageModel}
            onValueChange={(v) =>
              contentType === "text" ? setTextModel(v) : setImageModel(v)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(contentType === "text" ? TEXT_MODELS : IMAGE_MODELS).map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </>
          )}
        </Button>

        {(generatedText || generatedImage) && (
          <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
            <Label>Preview</Label>
            {generatedText && (
              <p className="text-sm whitespace-pre-wrap">{generatedText}</p>
            )}
            {generatedImage && (
              <div className="relative aspect-video overflow-hidden rounded-md">
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="object-cover w-full h-full"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Post to</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <Button
                    key={p.value}
                    variant={selectedPlatforms.includes(p.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePlatform(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handlePost}
              disabled={isPosting || !selectedPlatforms.length || !hasPublishableContent()}
              className="w-full"
            >
              {isPosting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Post now ({selectedPlatforms.length} platform
                  {selectedPlatforms.length === 1 ? "" : "s"})
                </>
              )}
            </Button>

            <div className="space-y-2 rounded-md border border-dashed border-border p-3">
              <Label className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Schedule (saved to scheduled_posts)
              </Label>
              <Input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSchedule}
                disabled={
                  isScheduling || !selectedPlatforms.length || !hasPublishableContent()
                }
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <CalendarClock className="h-4 w-4 mr-2" />
                    Schedule for later
                  </>
                )}
              </Button>
              {scheduleNotice && (
                <p className="text-sm text-muted-foreground">{scheduleNotice}</p>
              )}
            </div>

            {postResult && (
              <div className="space-y-2 text-sm">
                {Object.entries(postResult).map(([platform, result]) =>
                  platform === "_error" ? (
                    <p key={platform} className="text-destructive">
                      {result.error}
                    </p>
                  ) : (
                    <p
                      key={platform}
                      className={result.error ? "text-destructive" : "text-green-600"}
                    >
                      {platform}: {result.error ?? `Posted (ID: ${result.id})`}
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {scheduledPosts.length > 0 && (
          <div className="space-y-2">
            <Label>Upcoming scheduled posts</Label>
            <ul className="space-y-2 text-sm">
              {scheduledPosts.map((row) => (
                <li
                  key={row.id}
                  className="rounded-md border border-border px-3 py-2 flex flex-col gap-1"
                >
                  <span className="font-medium">
                  {row.scheduled_at ? format(new Date(row.scheduled_at), "PPpp") : "Not scheduled"}
                  </span>
                  <span className="text-muted-foreground">
                    {row.platforms.join(", ")} · {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
