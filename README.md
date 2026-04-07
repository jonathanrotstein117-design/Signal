## Signal

Signal is a Next.js app for AI-powered career intelligence, including company briefs, positioning guidance, career fair prep, and live role discovery.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` and add:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
RAPIDAPI_KEY=your_rapidapi_key_here
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## JSearch Setup

Discover role search uses the JSearch API from RapidAPI for real job postings and direct apply links.

To configure it:

1. Go to [JSearch on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch).
2. Subscribe to the free tier.
3. Copy your API key from the RapidAPI dashboard.
4. Add it as `RAPIDAPI_KEY` in `.env.local`.
5. Add the same `RAPIDAPI_KEY` in your Vercel environment variables before deploying.

If `RAPIDAPI_KEY` is missing or the API is rate-limited, Discover will show a friendly temporary-unavailable message instead of crashing.
