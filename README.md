# Focus — a personal productivity app

A clean React + Vite app wired for Supabase, ready to deploy on Vercel.
The main page shows **today's checklist** (tap to complete), a **streak counter**,
and a small mix of inputs: your **main focus** line and **deep-work hours**.

Built from the "build-an-app-from-scratch" method: a prepared starter where
auth/data/deploy are solved, plus one tight prompt describing only what you want.

## Run it locally

```bash
npm install
npm run dev
```

Runs immediately, saving to your browser. Connect Supabase to sync across devices.

## Connect Supabase

1. Create a project at supabase.com
2. Copy `.env.example` to `.env` and paste your Project URL + anon key
   (Supabase dashboard → Project Settings → API)
3. In the Supabase SQL editor, create the table the app uses:

```sql
create table focus_days (
  day date primary key,
  tasks jsonb not null default '[]',
  focus text,
  hours numeric,
  completed boolean not null default false,
  streak int not null default 0,
  last_completed_day date,
  sleep_hours numeric,
  sleep_quality int,
  pomodoros int default 0
);

create table goals (
  id bigint generated always as identity primary key,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
-- For a single-user personal app you can keep RLS off to start.
-- Turn RLS on and add policies before sharing it with anyone else.
```

The app has five pages: Today (checklist + streak + last night's sleep),
Timer (a Pomodoro work/break timer — finished work sessions add to today's
deep-work hours), Progress (deep-work chart plus streak, hours, average sleep,
and completion stats), Goals, and Settings (your default daily task template).
Until Supabase is connected it saves everything to your browser via
localStorage, so it works the moment you run it.

4. Restart `npm run dev`. The footer will say "Saving to Supabase."

## Deploy on Vercel

1. Push this folder to a GitHub repo
2. Import the repo at vercel.com
3. Add the two `VITE_SUPABASE_*` env vars in the Vercel project settings
4. Deploy — you get a live URL

## How the streak works

When you finish every item on today's checklist, the streak ticks up once for
that day. Finish your list the next day to keep it alive; miss a day and the
count stays put until you complete a list again. Adjust the rule in `App.jsx`
(`lastCompletedDay` logic) if you want a stricter reset-on-miss.

## The reusable prompt that built this

This is what was pasted into Claude Code against the starter — keep it to make
more changes:

> This is my existing React + Vite dashboard, already connected to Supabase and
> deployed on Vercel. Do NOT change any dependencies or my Supabase schema
> unless I explicitly ask.
>
> Step 1: Reset the main page (App.jsx) to a clean blank starting point.
>
> Step 2: Here's what I'm building: a personal focus & productivity app. The
> main page, top to bottom, shows: (1) today's checklist of focus tasks, big and
> front-and-center, tapped to complete; (2) a streak counter for consecutive
> days the list was completed; (3) a "main focus for today" text line and a
> deep-work hours number field.
>
> Rules:
> - Build ONLY what I listed above. No extra cards, no fake/demo data.
> - One clean page. Today's checklist is biggest and at the top.
> - Pull real data from Supabase. If a table doesn't exist yet, tell me what to create.
>
> Before writing any code, show me a short plan. Wait for my "go," then build.
