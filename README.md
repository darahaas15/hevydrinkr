# hevydrinkr

A social drinking session tracker. Log drinks, estimate BAC in real-time, compete on leaderboards, and get roasted by your friends every week.

Built as a mobile-first PWA with Next.js and Supabase.

## Features

**Session Tracking** -- Start a live session or log a past one. Add drinks from a library of 100+ options (with a heavy Indian brand selection), track rounds and who's buying, snap photos, and rate your night from *legendary* to *rough*.

**Real-Time BAC** -- Widmark formula estimation with gender-based distribution ratios, 30-minute absorption curves, and per-drink granularity. Shows peak BAC, time until sober, and safety status (sober / buzzed / tipsy / drunk / wasted).

**Social Feed** -- Post sessions with photos, captions, likes, and nested comments. Follow friends, manage groups with invite codes, and block anyone who can't handle the truth.

**Party Mode** -- Synchronized live drinking feed for group sessions. See what everyone's drinking in real-time via Supabase Realtime.

**Leaderboards** -- Total standard drinks, session count, longest session, drink variety, single-session max. Filter by friends, global, or group across week / month / all-time.

**Weekly Roasts** -- 17 algorithmically-assigned awards: Freight Train (most drinks), Lightweight, Night Owl, Broken Clock (weekday day-drinking), One Trick Pony, Mixologist, Ghost (0 sessions), and more. Max 2 roasts per person per week. Personalized copy seeded deterministically so the jokes don't change on refresh.

**Personal Records** -- Most drinks in a session, highest standard drink score, longest session, fastest back-to-back, longest streak, most sessions in a week.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, static export) |
| UI | React 19, Tailwind CSS 4, Framer Motion |
| State | Zustand (12 stores) |
| Backend | Supabase (Postgres + Realtime + Auth) |
| Icons | Tabler Icons + Lucide |
| PWA | Service Worker + Web App Manifest |

## Getting Started

```bash
git clone https://github.com/darahaas15/hevydrinkr.git
cd hevydrinkr
npm install
```

Create a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

```bash
npm run dev
```

## How Standard Drinks Work

```
standardDrinks = (volumeMl * ABV% / 100 * 0.789) / 14
```

Where `0.789` is alcohol density (g/mL) and `14` is the US standard drink in grams of pure alcohol. A 150mL glass of 12% wine = 1.0 standard drinks. A 150mL glass of 14% wine = 1.2.

## How BAC Works

Uses the Widmark formula with per-drink absorption modeling:

- Absorption window: 30 minutes per drink (sigmoid curve)
- Elimination rate: 0.015 BAC/hour (constant)
- Distribution ratios: male 0.68, female 0.55
- Peak BAC = sum of absorbed alcohol minus cumulative elimination

The app shows real-time status, hours until sober, and hours until safe to drive.
