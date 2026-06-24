"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client"; 
import { Badge } from  "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  Cpu,
  Globe,
  Image,
  Sparkles,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Content Engine",
    desc: "GPT-4o powered copywriting that sounds human — not robotic. Tailored to your brand voice and audience.",
  },
  {
    icon: Image,
    title: "Visual Content Generation",
    desc: "Generate stunning images for every post using DALL-E. Perfect aspect ratios for every platform.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    desc: "Visual content calendar with automated publishing. Set it once, post everywhere on time.",
  },
  {
    icon: Globe,
    title: "6 Platforms",
    desc: "X, LinkedIn, Instagram, Snapchat, YouTube, and TikTok — all managed from one elegant dashboard.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    desc: "Track engagement, reach, and impressions across all connected accounts in real time.",
  },
  {
    icon: Zap,
    title: "Trending Topics",
    desc: "Real-time news and trending topics feed directly into your content engine for timely, relevant posts.",
  },
];

const PLATFORMS = ["X (Twitter)", "LinkedIn", "Instagram", "Snapchat", "YouTube", "TikTok"];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const isAuthenticated = !!user;

  const getLoginUrl = () => {
    return "/dashboard";
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-primary-sm">
              <Cpu className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold gradient-text">OmniPost AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </button>
            </Link>
            {!loading && (
              isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="sm">
                    Open Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="sm">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-4 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-3xl" />
        </div>

        <div className="container relative text-center max-w-4xl mx-auto">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 px-4 py-1.5 text-sm">
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            AI-Powered Social Media Automation
          </Badge>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            Create content that{" "}
            <span className="gradient-text">actually sounds</span>
            <br />
            like you
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop wrestling with blank pages. OmniPost AI generates authentic, on-brand posts
            for all your platforms — then schedules and publishes them automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={getLoginUrl()}>
              <Button size="lg" className="px-8 h-12 text-base glow-primary">
                Start for free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="px-8 h-12 text-base">
                View pricing
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-primary" />
              Free forever plan
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-primary" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-primary" />
              Cancel anytime
            </span>
          </div>
        </div>
      </section>

      {/* Platform logos */}
      <section className="py-12 border-y border-border/40">
        <div className="container">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Publish to all major platforms from one place
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {PLATFORMS.map((p) => (
              <div
                key={p}
                className="px-5 py-2.5 rounded-full glass-subtle text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need to{" "}
              <span className="gradient-text">dominate social media</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From AI-generated copy to automated publishing — the complete toolkit for modern
              content creators and brands.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="card-premium p-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-24 px-4 border-t border-border/40">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">Start free. Upgrade when you need more.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="card-premium p-8">
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1">Free Forever</h3>
                <div className="text-4xl font-bold mb-2">USD 0</div>
                <p className="text-muted-foreground text-sm">Perfect for getting started</p>
              </div>
              <Separator className="mb-6" />
              <ul className="space-y-3 mb-8">
                {[
                  "5 AI-generated posts per month",
                  "Connect up to 2 platforms",
                  "Basic content scheduling",
                  "Content calendar view",
                  "Analytics dashboard",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <a href={getLoginUrl()}>
                <Button variant="outline" className="w-full">
                  Get started free
                </Button>
              </a>
            </div>

            {/* Pro */}
            <div className="relative card-premium p-8 border-primary/40 glow-primary">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4">
                Most Popular
              </Badge>
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1">Pro</h3>
                <div className="text-4xl font-bold mb-2">
                  USD 29
                  <span className="text-lg text-muted-foreground font-normal">/mo</span>
                </div>
                <p className="text-muted-foreground text-sm">For serious creators & brands</p>
              </div>
              <Separator className="mb-6" />
              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited AI-generated posts",
                  "All 6 social platforms",
                  "AI image generation",
                  "Advanced AI models (GPT-4o)",
                  "Priority scheduling",
                  "Trending topics integration",
                  "Advanced analytics",
                  "Priority support",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/pricing">
                <Button className="w-full glow-primary-sm">
                  Upgrade to Pro
                  <Zap className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/40">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold gradient-text">OmniPost AI</span>
          </div>
          
          <nav className="flex items-center gap-6">
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

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} OmniPost AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
