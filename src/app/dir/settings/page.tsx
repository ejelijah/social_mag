"use client";

import AppLayout from "@/components/ui/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export const dynamic = 'force-dynamic';
const BRAND_VOICES = [
  "professional", "casual", "witty", "inspirational", "educational", "bold", "empathetic",
] as const;

export default function SettingsPage() {
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Form State
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandVoice, setBrandVoice] = useState<typeof BRAND_VOICES[number]>("professional");
  const [avoidTopics, setAvoidTopics] = useState("");
  const [writingStyle, setWritingStyle] = useState("");
  const [dirty, setDirty] = useState(false);
  
  // Subscription State
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function loadSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setBrandName(profileData.brand_name ?? "");
        setNiche(profileData.niche ?? "");
        setTargetAudience(profileData.target_audience ?? "");
        setBrandVoice((profileData.brand_voice as typeof BRAND_VOICES[number]) ?? "professional");
        setAvoidTopics(profileData.avoid_topics ?? "");
        setWritingStyle(profileData.writing_style ?? "");
      }
      setLoading(false);
    }
    loadSettings();
  }, [supabase]);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        brand_name: brandName,
        niche: niche,
        target_audience: targetAudience,
        brand_voice: brandVoice,
        avoid_topics: avoidTopics,
        writing_style: writingStyle,
      })
      .eq('id', user.id);

    if (!error) {
      setDirty(false);
      alert("omnipost AI: Brand profile saved successfully!");
    } else {
      alert("Error saving profile: " + error.message);
    }
    setSaving(false);
  }

  function markDirty() {
    setDirty(true);
  }

  return (
    <AppLayout title="omnipost AI Settings">
      <div className="p-6 max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage your omnipost AI brand profile and subscription
          </p>
        </div>

        {/* Brand Profile */}
        <div className="border rounded-xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Brand Profile</h2>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="h-10 bg-gray-50 rounded-lg animate-pulse" />
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                    Brand Name
                  </label>
                  <Input
                    value={brandName}
                    onChange={(e) => { setBrandName(e.target.value); markDirty(); }}
                    className="bg-gray-50 border-gray-200 placeholder:text-gray-400"
                    placeholder=" Acme Co."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                    Niche
                  </label>
                  <Input
                    value={niche}
                    onChange={(e) => { setNiche(e.target.value); markDirty(); }}
                    className="bg-gray-50 border-gray-200 placeholder:text-gray-400"
                    placeholder ="sustainable fashion"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  Target Audience
                </label>
                <Textarea
                  value={targetAudience}
                  onChange={(e) => { setTargetAudience(e.target.value); markDirty(); }}
                  rows={2}
                  className="bg-gray-50 border-gray-200 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">
                  Brand Voice
                </label>
                <div className="flex flex-wrap gap-2">
                  {BRAND_VOICES.map((v) => (
                    <button
                      key={v}
                      onClick={() => { setBrandVoice(v); markDirty(); }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all",
                        brandVoice === v
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-gray-200 text-gray-500 hover:border-primary/40"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  Topics to Avoid
                </label>
                <Input
                  value={avoidTopics}
                  onChange={(e) => { setAvoidTopics(e.target.value); markDirty(); }}
                  placeholder="e.g. politics, competitors"
                  className="bg-gray-50 border-gray-200"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  Writing Style Notes
                </label>
                <Textarea
                  value={writingStyle}
                  onChange={(e) => { setWritingStyle(e.target.value); markDirty(); }}
                  rows={2}
                  placeholder="Any specific writing preferences..."
                  className="bg-gray-50 border-gray-200 resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Save omnipost Profile
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Subscription */}
        <div className=" border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Subscription</h2>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl  border border-gray-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold capitalize">{profile?.is_premium ? "Pro" : "Free"} Plan</span>
                <Badge
                  className={cn(
                    "text-[10px] border-none",
                    profile?.is_premium
                      ? "bg-primary/10 text-primary"
                      : "bg-gray-200 text-gray-600"
                  )}
                >
                  {profile?.is_premium ? "Active" : "Standard"}
                </Badge>
              </div>
              {profile?.is_premium ? (
                <p className="text-xs text-gray-500">
                  Unlimited omniposts · Renews monthly
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Limited to 5 posts per month
                </p>
              )}
            </div>
            {!profile?.is_premium && (
              <Button size="sm">
                Upgrade
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}