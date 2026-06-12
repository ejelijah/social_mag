# OmniPost AI Content Engine

A full-stack application that automates social media content creation and distribution across major platforms. Generate text, images, and videos with AI and post directly to authorized accounts.

## Features

- **Omni-Channel Content Generation**
  - **Text**: Captions, threads, blog posts via Gemini, Groq, or Mistral
  - **Images**: Marketing visuals via Pollinations.ai (free) or Hugging Face
  - **Video**: Pexels stock footage + Deepgram TTS (services ready)

- **Social Media Integration (OAuth 2.0)**
  - X (Twitter), Instagram, Facebook Pages, LinkedIn, YouTube, TikTok, Pinterest
  - Centralized Account Manager to connect/disconnect platforms

- **Automated Posting**
  - Direct API posting for text and images
  - Preview content before posting

- **Secure Token Management**
  - OAuth tokens stored in PostgreSQL via Prisma

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Shadcn/UI
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (app login + social OAuth)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

Required for basic operation:
- `NEXTAUTH_SECRET` – Generate with `openssl rand -base64 32`
- `DATABASE_URL` – PostgreSQL connection string (e.g. Supabase)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – For app sign-in
- At least one AI key: `GEMINI_API_KEY`, `GROQ_API_KEY`, or `MISTRAL_API_KEY`

### 3. Set up the database

```bash
npm run db:generate
npm run db:push
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth
│   │   ├── generate/text/        # Text generation
│   │   ├── generate/image/       # Image generation
│   │   ├── post/                 # Post to platforms
│   │   ├── accounts/             # List/delete social accounts
│   │   ├── oauth/[provider]/      # OAuth connect flow
│   │   └── pexels/               # Stock video search
│   ├── dashboard/                # Main dashboard
│   ├── settings/                 # Account & API config
│   └── page.tsx                  # Landing
├── components/
│   ├── content-generator.tsx     # AI content + preview + post
│   ├── account-manager.tsx       # Connect/disconnect platforms
│   └── ui/                       # Shadcn components
├── services/
│   ├── ai/                       # Gemini, Groq, Mistral, Pollinations, etc.
│   └── social/                   # Platform-specific posting (x, instagram, etc.)
└── lib/
    ├── auth.ts
    └── prisma.ts
```

## OAuth Setup

Each platform requires a developer app and OAuth credentials:

- **X**: [developer.twitter.com](https://developer.twitter.com)
- **Instagram/Facebook**: [developers.facebook.com](https://developers.facebook.com)
- **LinkedIn**: [linkedin.com/developers](https://www.linkedin.com/developers)
- **YouTube**: [console.cloud.google.com](https://console.cloud.google.com) (same as Google)
- **TikTok**: [developers.tiktok.com](https://developers.tiktok.com)
- **Pinterest**: [developers.pinterest.com](https://developers.pinterest.com)

Set the OAuth redirect URI to:
`http://localhost:3000/api/oauth/{provider}/callback`

(Replace `{provider}` with: x, instagram, facebook, linkedin, youtube, tiktok, pinterest)

## License

ISC
