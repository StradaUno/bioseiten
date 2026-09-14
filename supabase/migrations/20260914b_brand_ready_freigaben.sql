-- Repo-Kopie. Angewendet am 14.09.2026 ueber Supabase `apply_migration`
-- (Migration `brand_ready_freigaben`). Diese Datei ist Dokumentation, nicht
-- die Deploy-Quelle -- es gibt keine lokale Supabase-CLI in diesem Repo.

-- Teilbarer Brand-Ready-Stand.
--
-- Der Schnappschuss wird SERVERSEITIG gerechnet (Edge Function
-- brand-ready-freigeben laedt dasselbe Regelwerk wie die App), nicht vom
-- Browser geschickt: auf der geteilten Seite steht "powered by viuno",
-- und viuno darf nicht mit seinem Namen fuer eine Zahl buergen, die der
-- Creator selbst setzen konnte.
--
-- Geteilt wird ausschliesslich Punktestand und die zwei bis drei Saetze.
-- Kriterienliste, Eigenangaben und Analyse-Rohzahlen bleiben im Haus.

create table if not exists public.brand_ready_freigaben (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  user_id         uuid references public.users(id) on delete cascade,
  platform        text not null check (platform in ('instagram','tiktok')),
  punkte          smallint not null,
  max_punkte      smallint not null,
  saetze          jsonb not null,
  stichtag        timestamptz,
  anzeigename     text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  aufrufe         integer not null default 0,
  zuletzt_gesehen timestamptz,
  -- Ein Link je Kanal. Ein zweiter wuerde nur dafuer sorgen, dass zwei
  -- verschiedene Staende desselben Kanals im Umlauf sind.
  unique (user_id, platform)
);

alter table public.brand_ready_freigaben enable row level security;

-- Lesen und Zuruecknehmen nur der eigene Account; geschrieben wird
-- ausschliesslich ueber den Service Role (keine Insert-Policy) -- genau
-- wie bei biolink_aufrufe und analyse_freigaben.
create policy brand_ready_freigaben_select on public.brand_ready_freigaben
  for select to authenticated using (auth.uid() = user_id);
create policy brand_ready_freigaben_update on public.brand_ready_freigaben
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, update on public.brand_ready_freigaben to authenticated;

-- account_typ wird beantwortbar: raw_profile liefert die Kategorie auf
-- TikTok nie und auf Instagram nicht immer. Wer nicht messen kann und auch
-- nicht fragen laesst, laesst ein Kriterium dauerhaft tot liegen.
alter table public.brand_ready_angaben
  drop constraint brand_ready_angaben_kriterium_check;
alter table public.brand_ready_angaben
  add constraint brand_ready_angaben_kriterium_check check (kriterium in (
    'account_typ','biolink','impressum','kontakt','kit_vorhanden','kit_aktuell',
    'kit_preise','referenzen','demografie','rechnung'
  ));
