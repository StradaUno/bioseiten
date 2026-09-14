-- Admin-Neubau, 15.09.2026.
-- Angewendet ueber die Supabase-MCP-Migrationen; diese Datei ist die
-- Dokumentation im Repo, nicht die Quelle der Anwendung.
--
-- Vier Teile:
--   1. kosten_guthaben      -- Guthaben je Anbieter, Verlauf statt Ueberschreiben
--   2. analysis_runs        -- zwei Spalten fuer die Apify-Kosten je Lauf
--   3. admin_errors         -- die anon-Policies waren USING (true)
--   4. viuno_herkunft()     -- Herkunft der Startseiten-Besucher, benannt
--   5. admin_uebersicht()   -- alle Kennzahlen in einer Abfrage
--
-- Der vollstaendige Text von admin_uebersicht() steht nicht hier, sondern in
-- der Datenbank: die Funktion ist ~200 Zeilen und wird ueber CREATE OR REPLACE
-- gepflegt. Aenderungen daran gehoeren in eine neue Migrationsdatei.

-- ── 1. Guthaben je Anbieter ───────────────────────────────────────────
create table if not exists public.kosten_guthaben (
  id          uuid primary key default gen_random_uuid(),
  anbieter    text not null check (anbieter in ('anthropic','apify')),
  betrag_usd  numeric(10,2) not null check (betrag_usd >= 0),
  stand_am    timestamptz not null default now(),
  notiz       text,
  erfasst_von uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists kosten_guthaben_anbieter_idx
  on public.kosten_guthaben (anbieter, stand_am desc);
alter table public.kosten_guthaben enable row level security;
drop policy if exists kosten_guthaben_nur_admin on public.kosten_guthaben;
create policy kosten_guthaben_nur_admin on public.kosten_guthaben
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── 2. Apify-Kosten je Analyse-Lauf ───────────────────────────────────
-- Beide nullable. Die fuenf Laeufe von vor dem Umbau haben keine Werte --
-- drei davon wurden nachtraeglich aus der Apify-Run-API geholt, zwei sind
-- zu alt. Das ist in Ordnung.
alter table public.analysis_runs
  add column if not exists apify_kosten_usd   numeric(10,4),
  add column if not exists apify_kosten_stand timestamptz;

-- ── 3. admin_errors war fuer jeden lesbar ─────────────────────────────
-- "anon read admin_errors" und "anon update admin_errors" standen beide auf
-- USING (true). Der anon-Key steht im Quelltext jeder oeffentlichen Seite:
-- damit konnte jeder alle Fehlermeldungen samt User-IDs und E-Mail-Adressen
-- lesen und sie als erledigt markieren. Geschrieben wird die Tabelle nur von
-- log_error() (SECURITY DEFINER) und vom Service Role; clientseitig liest sie
-- niemand ausser dem Admin.
drop policy if exists "anon read admin_errors"   on public.admin_errors;
drop policy if exists "anon update admin_errors" on public.admin_errors;
drop policy if exists admin_errors_nur_admin     on public.admin_errors;
create policy admin_errors_nur_admin on public.admin_errors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── 4. Apify-Kosten addieren ──────────────────────────────────────────
-- Als Funktion und nicht als Lesen-dann-Schreiben, weil Instagram ZWEI
-- Actor-Laeufe hat und zwei gleichzeitige Meldungen sonst einen Betrag
-- verlieren wuerden.
create or replace function public.analyse_apify_kosten_addieren(p_run uuid, p_usd numeric)
returns void language sql security definer set search_path to 'public' as $$
  update analysis_runs
     set apify_kosten_usd   = coalesce(apify_kosten_usd, 0) + greatest(coalesce(p_usd, 0), 0),
         apify_kosten_stand = now()
   where id = p_run;
$$;
revoke all on function public.analyse_apify_kosten_addieren(uuid, numeric) from public, anon, authenticated;

-- ── 5. viuno_herkunft() ───────────────────────────────────────────────
-- Siehe Datenbank fuer den vollen Text. Bildet eine rohe Herkunft auf einen
-- lesbaren Namen ab und benennt die EIGENEN Seiten einzeln
-- ("BioLink: antonietta", "Analyse (geteilt)", "Creator News"), damit im
-- Admin steht, ueber welche viuno-Seite jemand auf die Startseite kam.
-- Aufgeloest wird erst hier und nicht schon auf der Seite: so laesst sich die
-- Zuordnung aendern, ohne jede Seite neu auszuliefern, und sie gilt
-- rueckwirkend.
