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

-- Community blades shared from the Forge (added October 2026). Safe to run again.
create table if not exists community_blades (
  id        text primary key,
  name      text not null,
  icon_id   text not null default 'custom',
  rows      jsonb not null,
  author    text not null,
  author_id text not null,
  at        timestamptz not null default now(),
  uses      integer not null default 0
);
create index if not exists community_blades_at on community_blades (at desc);
alter table community_blades enable row level security;

-- Play vs AI counters, one row per bot (added October 2026). Safe to run again.
create table if not exists bot_stats (
  id             text primary key,
  played         integer not null default 0,
  player_wins    integer not null default 0,
  best_chain     integer not null default 0,
  fastest_win_ms integer not null default 0,
  total_ms       bigint not null default 0
);
alter table bot_stats enable row level security;
