import type { SocialAccount } from "@/types/social";
import { postToX } from "./x";
import { postToInstagram } from "./instagram";
import { postToFacebook } from "./facebook";
import { postToLinkedIn } from "./linkedin";
import { postToYouTube } from "./youtube";
import { postToTikTok } from "./tiktok";
import { postToPinterest } from "./pinterest";

export type Platform =
  | "x"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "snapchat";

export interface PostContent {
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
  description?: string;
  tags?: string[];
}

export async function postToPlatform(
  account: SocialAccount,
  platform: Platform,
  content: PostContent
): Promise<{ id: string }> {
  switch (platform) {
    case "x":
      return postToX(account, { text: content.text, imageUrl: content.imageUrl });
    case "instagram":
      if (!content.imageUrl) throw new Error("Instagram requires an image");
      return postToInstagram(account, { text: content.text, imageUrl: content.imageUrl });
    case "facebook":
      return postToFacebook(account, { text: content.text, imageUrl: content.imageUrl });
    case "linkedin":
      return postToLinkedIn(account, { text: content.text, imageUrl: content.imageUrl });
    case "youtube":
      return postToYouTube(account, {
        title: content.title ?? content.text.slice(0, 100),
        description: content.description ?? content.text,
        videoUrl: content.videoUrl,
        tags: content.tags,
      });
    case "tiktok":
      if (!content.videoUrl) throw new Error("TikTok requires a video");
      return postToTikTok(account, { text: content.text, videoUrl: content.videoUrl });
    case "pinterest":
      if (!content.imageUrl) throw new Error("Pinterest requires an image");
      return postToPinterest(account, {
        text: content.text,
        imageUrl: content.imageUrl,
        link: content.text,
      });
    case "snapchat":
      throw new Error("Snapchat posting not yet implemented");
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}
