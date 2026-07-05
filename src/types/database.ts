/**
 * Reflects `public.users` (expects `id` = auth user id, plus email, name, avatar_url, needs_name_setup).
 */
export type PublicUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  /** When true, non-Google users should complete `/settings/name` once. */
  needs_name_setup: boolean;
  updated_at?: string | null;
};

/**
 * Reflects `public.scheduled_posts`
 */
export type ScheduledPostRow = {
  id: string;
  user_id: string;
  platforms: string[];
  content: { text: string; imageUrl?: string };
  scheduled_at: string;
  status: string;
  createdAt?: string | null;
};
