/**
 * Shape passed into platform posting helpers after loading tokens from `social_accounts`.
 */
export type SocialAccount = {
  accessToken: string;
  providerId?: string | null;
  metadata?: Record<string, unknown> | null;
};
