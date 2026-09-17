-- Neue App (17.09.2026): "einmal eingeben, ueberall aktivieren".
-- Je Link und je Kanal ein Schalter fuer BioLink und Media Kit. Fehlt ein
-- Eintrag, gilt "an" -- bestehende Seiten verhalten sich unveraendert.
-- Rueckbau: die vier Spalten, die Tabelle mediakit_eigene_leistungen, die
-- View mediakit_links_public und die Policy mediakit_aufrufe_eigene_lesen
-- entfernen; die drei Views biopage_v2 / mediakit_public /
-- biolink_links_public auf den Stand vor dem 17.09. zuruecksetzen.

alter table public.biolink_custom_links
  add column if not exists im_biolink boolean not null default true,
  add column if not exists im_mediakit boolean not null default false;

-- {"instagram":{"biolink":true,"mediakit":false}, ...}; fehlender Eintrag = an.
alter table public.users
  add column if not exists kanal_anzeige jsonb not null default '{}'::jsonb;

alter table public.mediakit_brands
  add column if not exists im_mediakit boolean not null default true;

create or replace function public.kanal_an(p jsonb, p_kanal text, p_seite text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce((p -> p_kanal ->> p_seite)::boolean, true)
$$;

-- Eigene Leistungen (bis zu vier), neben den vier festen offer_types.
create table if not exists public.mediakit_eigene_leistungen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  titel text not null,
  preis_von numeric,
  preis_bis numeric,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.mediakit_eigene_leistungen enable row level security;
drop policy if exists mediakit_eigene_leistungen_own on public.mediakit_eigene_leistungen;
create policy mediakit_eigene_leistungen_own on public.mediakit_eigene_leistungen
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists mediakit_eigene_leistungen_read on public.mediakit_eigene_leistungen;
create policy mediakit_eigene_leistungen_read on public.mediakit_eigene_leistungen
  for select to anon, authenticated using (public.is_mediakit_active(user_id));
grant select, insert, update, delete on public.mediakit_eigene_leistungen to authenticated;
grant select on public.mediakit_eigene_leistungen to anon;

create or replace function public.check_eigene_leistungen_max()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.mediakit_eigene_leistungen where user_id = new.user_id) >= 4 then
    raise exception 'Maximal 4 eigene Leistungen';
  end if;
  return new;
end $$;
drop trigger if exists trg_eigene_leistungen_max on public.mediakit_eigene_leistungen;
create trigger trg_eigene_leistungen_max before insert on public.mediakit_eigene_leistungen
  for each row execute function public.check_eigene_leistungen_max();

-- Media-Kit-Aufrufe: der eigene Account darf sie lesen (wie biolink_aufrufe).
drop policy if exists mediakit_aufrufe_eigene_lesen on public.mediakit_aufrufe;
create policy mediakit_aufrufe_eigene_lesen on public.mediakit_aufrufe
  for select to authenticated using (auth.uid() = user_id);

-- Oeffentliche Views respektieren die Schalter. Spaltenliste unveraendert.
create or replace view public.biolink_links_public as
 select l.id, l.user_id, l."position", l.title, l.url, l.is_paid
   from public.biolink_custom_links l
   join public.users u on u.id = l.user_id
  where u.bio_active = true and coalesce(l.im_biolink, true);

create or replace view public.mediakit_links_public as
 select l.id, l.user_id, l."position", l.title, l.url, l.is_paid
   from public.biolink_custom_links l
   join public.users u on u.id = l.user_id
  where u.mediakit_active = true and coalesce(l.im_mediakit, false);
grant select on public.mediakit_links_public to anon, authenticated;

create or replace view public.biopage_v2 as
 select u.id as user_id, u.display_name, u.profile_image_url,
    case when public.kanal_an(u.kanal_anzeige,'instagram','biolink') then u.instagram_handle end as instagram_handle,
    case when public.kanal_an(u.kanal_anzeige,'tiktok','biolink')    then u.tiktok_handle    end as tiktok_handle,
    case when public.kanal_an(u.kanal_anzeige,'youtube','biolink')   then u.youtube_handle   end as youtube_handle,
    case when public.kanal_an(u.kanal_anzeige,'threads','biolink')   then u.threads_handle   end as threads_handle,
    u.contact_email, u.niche_category, u.city, u.is_verified, u.bio_active, u.impressum_text,
    b.theme, u.bio, b.default_language
   from public.users u
   left join public.biolink_viuno b on b.user_id = u.id
  where u.bio_active = true;

create or replace view public.mediakit_public as
 select u.id as user_id, u.display_name, u.profile_image_url,
    case when public.kanal_an(u.kanal_anzeige,'instagram','mediakit') then u.instagram_handle end as instagram_handle,
    case when public.kanal_an(u.kanal_anzeige,'tiktok','mediakit')    then u.tiktok_handle    end as tiktok_handle,
    case when public.kanal_an(u.kanal_anzeige,'youtube','mediakit')   then u.youtube_handle   end as youtube_handle,
    case when public.kanal_an(u.kanal_anzeige,'threads','mediakit')   then u.threads_handle   end as threads_handle,
    u.contact_email, public.nische_label(u.niche_category) as niche_category, u.city, u.bio, u.impressum_text, u.mediakit_active,
    mv.er_instagram, mv.er_tiktok, mv.avg_likes_instagram, mv.avg_views_tiktok, mv.gender_female_pct, mv.gender_male_pct,
    mv.top_country_1, mv.top_country_1_pct, mv.top_country_2, mv.top_country_2_pct,
    mv.followers_instagram, mv.followers_tiktok, mv.followers_youtube, mv.followers_threads,
    coalesce(mv.default_language, 'de'::text) as default_language, mv.pitch,
    mv.avg_comments_instagram, mv.avg_comments_tiktok, mv.avg_views_instagram, mv.avg_shares_tiktok,
    mv.gemessen_am_instagram, mv.gemessen_am_tiktok,
    mv.alter_18_24, mv.alter_25_34, mv.alter_35_44, mv.alter_45plus,
    mv.vorlauf_tage, mv.nutzungsrechte, mv.exklusivitaet, mv.freigabe_schleifen, mv.preis_hinweis
   from public.users u
   left join public.mediakit_viuno mv on mv.user_id = u.id
  where u.mediakit_active = true;

-- users hat spaltenweise UPDATE-Rechte fuer authenticated; eine neue Spalte
-- ist ohne eigenen Grant nicht schreibbar ("permission denied for table users").
grant update (kanal_anzeige) on public.users to authenticated;

-- Willkommens-Analyse: erstanalyse_freischalten() legt eine Kaufzeile ohne
-- Stripe-Session an, die Spalte war aber NOT NULL -- die Funktion ist seit
-- ihrer Einfuehrung an dieser Stelle gescheitert (UNIQUE bleibt, NULL ist dort erlaubt).
alter table public.analysis_purchases alter column stripe_checkout_session_id drop not null;

-- 18.09.2026: Bio je Seite schaltbar ueber users.kanal_anzeige -> "bio"
-- (biopage_v2 und mediakit_public blenden sie per kanal_an() aus; generate-biolink
-- backt sie nur ein, wenn sie fuer den BioLink an ist). viuno_profilcheck zaehlt
-- brand_ready_angaben 'biolink' / 'kit_vorhanden' (Seite bei anderem Anbieter)
-- als erfuellt. Die vollstaendigen Definitionen stehen in der Datenbank;
-- dieses Skript ist die Notiz, nicht die Quelle.

-- Nische "Sonstiges": users_niche_category_check um 'sonstiges' erweitert
-- (angewendet 17.09.2026; nische_label() liefert dafuer "Sonstiges" ueber initcap).

-- 17.09.2026 (spaet): biopage_v2 bekommt die Spalte reihenfolge
-- (users.kanal_anzeige -> "reihenfolge", Liste aus instagram | tiktok | youtube |
-- threads | link:<uuid>), die BioLink-Vorlage sortiert danach (generate-biolink v28).
-- nutzungsbedingungen_zustimmen(p_typ) schreibt die Zustimmung zu
-- biopage_terms / mediakit_terms nach user_consents (Version = Datum von
-- legal_texts.updated_at); die App fragt vor dem Einschalten einer Seite danach.

-- 17.09.2026 (Abo): subscriptions bekommt stripe_customer_id, stripe_mode, status,
-- kuendigung_zum, updated_at; abo_aktiv(p_user) prueft plan='abo' + is_active +
-- expires_at (3 Tage Karenz). mediakit_viuno.avg_views_30_instagram/_tiktok werden
-- von mediakit_auto_sync() aus Puls und Analyse gefuellt (je Beitrag einmal,
-- letzte 30 Tage), mediakit_public gibt sie aus. pg_cron 'abo-wochenanalyse'
-- (Sonntag 03:00 UTC) ruft viuno_cron_post('abo-wochenanalyse').
-- deals und competitor_accounts sind geloescht (brand_ratings verlor dabei nur
-- den Fremdschluessel), viuno_news_profil kommt ohne deals aus.

-- 18.09.2026: stripe_prices_platform_check laesst 'abo' zu (Abo-Preis je Modus).
-- brand-ready-freigeben v12 rechnet mit viuno_profilcheck() -- dieselbe Zahl wie
-- die App; Brand Ready und die Freigabe sind Teil des Abos (abo_aktiv()).

-- ---------------------------------------------------------------------------
-- 18.09.2026 · Analyse-Umbau (acht Boxen) und Beitragsbilder
-- ---------------------------------------------------------------------------
-- Die Analyse-Seite zeigt jeden Beitrag des Laufs als Karte mit Vorschaubild.
-- Instagram-Vorschaulinks laufen nach rund vier Tagen ab, deshalb werden die
-- Bilder der Ranglisten-Beitraege (Top, Flop, Kommentar, je bis zu sechs)
-- kopiert -- sonst keine -- und nach acht Wochen wieder geloescht.
create table if not exists public.analyse_beitragsbilder (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null,
  post_id text not null,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  pfad text not null,
  gesichert_am timestamptz not null default now(),
  unique (user_id, platform, post_id)
);
alter table public.analyse_beitragsbilder enable row level security;
create policy analyse_beitragsbilder_eigene on public.analyse_beitragsbilder for select to authenticated using (auth.uid() = user_id);
grant select on public.analyse_beitragsbilder to authenticated;
create index if not exists analyse_beitragsbilder_run_idx on public.analyse_beitragsbilder (analysis_run_id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('beitragsbilder', 'beitragsbilder', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy beitragsbilder_oeffentlich_lesen on storage.objects for select to anon, authenticated using (bucket_id = 'beitragsbilder');
-- Sobald die Zahlen eines Laufs stehen, holt die Function analyse-bilder die
-- Bilder (die Links sind dann frisch). Aufruf ueber viuno_cron_post + x-schluessel.
create or replace function public.trg_analyse_bilder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.viuno_cron_post('analyse-bilder', jsonb_build_object('analysis_run_id', new.analysis_run_id, 'platform', new.platform));
  return new;
end $$;
create trigger bilder_bei_analyse after insert on public.analyse_stats
  for each row execute function public.trg_analyse_bilder();

-- Fehler gefunden beim Testen: subscriptions_plan_check liess nur 'free' und
-- 'pro' zu, der Stripe-Webhook schreibt aber plan = 'abo'. Das erste bezahlte
-- Abo waere an dieser Pruefung gescheitert.
alter table public.subscriptions drop constraint subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan = any (array['free','pro','abo']));
