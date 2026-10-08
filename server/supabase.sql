-- Sword's Pass online results. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- The game server writes with the service_role key (kept in Render's environment, never in the
-- browser), which bypasses row-level security. RLS is on with no policies, so the public anon key
-- can't read or change anything.
create table if not exists players (
  pid        text primary key,
  name       text not null,
  rating     integer not null default 1000,
  wins       integer not null default 0,
  losses     integer not null default 0,
  played     integer not null default 0,
  ffa_wins   integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists players_rating on players (rating desc);

create table if not exists results (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  mode    text not null,
  winner  text,
  players jsonb not null
);
create index if not exists results_at on results (at desc);

alter table players enable row level security;
alter table results enable row level security;
