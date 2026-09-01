# OmniPost AI Content Engine

OmniPost is a high-performance, full-stack application designed to automate the entire lifecycle of social media content—from AI-driven ideation and generation to multi-platform distribution. It leverages modern edge computing and advanced OAuth2 workflows to provide a seamless "one-to-many" posting experience.

## 🚀 Features

- **Multi-Model AI Content Generation**
  - **Text**: Context-aware captions and threads using Gemini, Groq, or Mistral.
  - **Images**: High-fidelity marketing visuals via Pollinations.ai and Hugging Face.
  - **Video**: Automated assembly using Pexels stock footage and Deepgram TTS.

- **Enterprise-Grade Social Integration (OAuth 2.0)**
  - Direct integration with **TikTok (V2 API)**, X (Twitter), Instagram, Facebook, LinkedIn, YouTube, and Pinterest.
  - Centralized Account Manager for real-time connection status and platform management.

- **Advanced Video Distribution**
  - Implements TikTok's **"Pull from URL"** publishing flow for efficient high-resolution video delivery.
  - Automated domain verification handling for secure content fetching.

- **Robust Edge Infrastructure**
  - **Supabase Edge Functions (Deno)**: Decoupled, high-availability microservices for handling long-running API tasks.
  - **Automated Token Management**: Proactive OAuth2 token refresh logic to ensure zero-session expiration.

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Shadcn/UI
- **Backend**: Next.js API Routes & Supabase Edge Functions (TypeScript/Deno)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js for application security; custom OAuth2 flows for platform linking
- **Hosting/DNS**: Netlify & Porkbun

## 🏗 Technical Highlights (Internship Ready)

- **Distributed Systems**: Utilizes a hybrid architecture of Next.js for the UI and Supabase Edge Functions for background processing.
- **Complex API Integration**: Successfully navigated the strict TikTok V2 API requirements, including Content-Type handling and domain verification.
- **State Management**: Orchestrates complex multi-platform posting states and error handling for failed network requests.
- **DevOps**: Managed DNS propagation (TXT records) and environment-specific secrets for secure, production-ready deployments.

## 🚦 Getting Started

### 1. Install Dependencies

```bash
npm install

src/
├── app/
│   ├── api/
│   │   ├── auth/          # NextAuth configuration
│   │   ├── generate/      # AI Generation endpoints
│   │   └── oauth/         # Multi-platform callback handlers
│   └── dashboard/         # Content orchestration UI
├── supabase/
│   └── functions/         # Deno-based Edge Functions for TikTok/Social posting
├── services/
│   ├── ai/                # LLM & Image model implementations
│   └── social/            # Platform-specific SDKs and API wrappers
└── lib/                   # Shared Prisma and Auth utilities


ach platform requires a developer app. Set your OAuth redirect URI to:
https://your-domain.com/api/oauth/{provider}/callback

Note: For TikTok, ensure the video.upload and video.publish scopes are enabled in your Developer Console and your domain is verified via DNS TXT records.

📄 License
This project is licensed under the ISC License.