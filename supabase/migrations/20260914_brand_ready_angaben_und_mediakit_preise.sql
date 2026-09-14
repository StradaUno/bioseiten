-- Repo-Kopie. Angewendet am 14.09.2026 ueber Supabase `apply_migration`
-- (Migration `brand_ready_angaben_und_mediakit_preise`). Wie bei den Edge
-- Functions ist diese Datei Dokumentation, nicht die Deploy-Quelle:
-- es gibt keine lokale Supabase-CLI und kein config.toml in diesem Repo.
-- Wer hier etwas aendert, muss es auch anwenden -- und umgekehrt.
--
-- Rein additiv: zwei neue Tabellen, eine fehlende Lese-Policy. Keine
-- bestehende Spalte, Policy, View oder Function wird angefasst.

create table if not exists public.brand_ready_angaben (
  user_id    uuid not null references public.users(id) on delete cascade,
  kriterium  text not null,
  wert       boolean,                -- NULL = nicht beantwortet
  zahl       smallint,               -- nur fuer 'referenzen'
  updated_at timestamptz not null default now(),
  primary key (user_id, kriterium),
  -- Ohne diesen CHECK schreibt ein Tippfehler im Client still eine Zeile,
  -- die nie gelesen wird -- dieselbe Fehlerklasse wie saveBioHandles.
  constraint brand_ready_angaben_kriterium_check check (kriterium in (
    'biolink','impressum','kontakt','kit_vorhanden','kit_aktuell',
    'kit_preise','referenzen','demografie','rechnung'
  )),
  constraint brand_ready_angaben_zahl_check check (zahl is null or zahl >= 0)
);

alter table public.brand_ready_angaben enable row level security;

create policy brand_ready_angaben_select on public.brand_ready_angaben
  for select to authenticated using (auth.uid() = user_id);
create policy brand_ready_angaben_insert on public.brand_ready_angaben
  for insert to authenticated with check (auth.uid() = user_id);
create policy brand_ready_angaben_update on public.brand_ready_angaben
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy brand_ready_angaben_delete on public.brand_ready_angaben
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.brand_ready_angaben to authenticated;

-- Preise BEWUSST in eigener Tabelle statt als zwei Spalten in
-- mediakit_content_offers: die hat eine anon-Lesepolicy
-- (is_mediakit_active) und public/kit/antonietta/index.html liest sie mit
-- select('*'). Preisspalten dort waeren ueber den anon-Key fuer jeden
-- abrufbar, sobald ein Media Kit aktiv ist. Preise sind
-- Verhandlungsposition -- hier gibt es keinen anon-Zugriff.
create table if not exists public.mediakit_preise (
  user_id    uuid not null references public.users(id) on delete cascade,
  offer_type public.mediakit_offer_type not null,
  preis_von  numeric,
  preis_bis  numeric,
  updated_at timestamptz not null default now(),
  primary key (user_id, offer_type),
  constraint mediakit_preise_von_check    check (preis_von is null or preis_von >= 0),
  constraint mediakit_preise_bis_check    check (preis_bis is null or preis_bis >= 0),
  constraint mediakit_preise_spanne_check check (
    preis_von is null or preis_bis is null or preis_bis >= preis_von
  )
);

alter table public.mediakit_preise enable row level security;

create policy mediakit_preise_select on public.mediakit_preise
  for select to authenticated using (auth.uid() = user_id);
create policy mediakit_preise_insert on public.mediakit_preise
  for insert to authenticated with check (auth.uid() = user_id);
create policy mediakit_preise_update on public.mediakit_preise
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy mediakit_preise_delete on public.mediakit_preise
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.mediakit_preise to authenticated;

-- niche_mappings hatte RLS an, aber keine einzige Policy -- lesbar war es
-- damit nur ueber den Service Role. Der Bio-Check braucht das Vokabular im
-- Client. 75 neutrale Schlagworte ohne Personenbezug; die Alternative waere
-- eine Kopie der Liste in der SPA und damit eine zweite Wahrheit.
create policy niche_mappings_read on public.niche_mappings
  for select to authenticated using (true);
