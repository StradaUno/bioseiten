-- ROLLBACK.sql — nimmt die Datenbank-Aenderungen des Launch-Checks (15.09.2026) zurueck.
-- Jeder Abschnitt ist fuer sich ausfuehrbar. Reihenfolge: von unten nach oben ist nicht noetig,
-- die Abschnitte sind unabhaengig. Ausfuehren im SQL-Editor des Supabase-Dashboards als postgres.
--
-- ACHTUNG: Abschnitt 1c (Cron-Befehle) nur zusammen mit dem Zuruecksetzen der Edge Functions
-- auf die vorherige Version (Dashboard -> Edge Functions -> Versionen). Die neuen Versionen
-- akzeptieren den alten CRON_TOKEN nicht mehr, die alten Versionen kennen den Vault-Schluessel nicht.

-- =====================================================================
-- 1. Sicherheit (Migration launch_check_sicherheit_1)
-- =====================================================================

-- 1a. Policies
create policy "anon read creator_analytics" on public.creator_analytics for select to anon using (true);
create policy "service_all" on public.competitor_accounts for all to public using (true) with check (true);
drop policy if exists "mediakit_aufrufe_insert" on public.mediakit_aufrufe;
create policy "mediakit_aufrufe_insert" on public.mediakit_aufrufe for insert to anon, authenticated with check (true);

-- 1b. Funktionsrechte
grant execute on function public.get_platform_stats(uuid) to public, anon, authenticated;
grant execute on function public.get_bio_hourly_stats(uuid) to public, anon, authenticated;
grant execute on function public.get_bio_referrer_stats(uuid) to public, anon, authenticated;
grant execute on function public.get_bio_stats_flat(uuid) to public, anon, authenticated;
grant execute on function public.get_bio_views_last_7_days(uuid) to public, anon, authenticated;
grant execute on function public.get_bio_views_today(uuid) to public, anon, authenticated;
grant execute on function public.get_biolink_views(uuid) to public, anon, authenticated;
grant execute on function public.get_biolink_views_last_7_days_daily(uuid) to public, anon;
grant execute on function public.track_bio_view(uuid) to public, anon, authenticated;
grant execute on function public.track_bio_view(uuid, text) to public, anon, authenticated;
grant execute on function public.increment_bio_view(uuid, date) to public, anon, authenticated;
grant execute on function public.update_biolink_view_aggregates(uuid) to public, anon, authenticated;
grant execute on function public.update_mediakit_view_aggregates(uuid) to public, anon, authenticated;
grant execute on function public.record_consent(uuid, text, text, text, text, text) to public, anon, authenticated;
grant execute on function public.has_consent(uuid, text, text) to public, anon, authenticated;
grant execute on function public.log_error(text, text, uuid) to public, anon, authenticated;
grant execute on function public.purge_alte_analysedaten() to public, anon, authenticated;
grant execute on function public.purge_abgelaufene_freigaben() to public, anon, authenticated;
grant execute on function public.fail_stale_analysis_runs() to public, anon, authenticated;
grant execute on function public.increment_blacklist_hit(text) to public, anon, authenticated;
grant execute on function public.rls_auto_enable() to public, anon, authenticated;
grant execute on function public.get_mediakit_views_last_7_days_daily(uuid) to public, anon;

-- get_mediakit_views_last_7_days_daily ohne auth.uid-Sperre (Stand vor dem 15.09.2026)
create or replace function public.get_mediakit_views_last_7_days_daily(p_user_id uuid)
 returns table(view_date date, view_count integer)
 language plpgsql security definer set search_path to 'public'
as $function$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval)::date AS d
  ),
  counts AS (
    SELECT viewed_at::date AS d, COUNT(*)::integer AS c
    FROM mediakit_aufrufe
    WHERE user_id = p_user_id AND viewed_at >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY viewed_at::date
  )
  SELECT ds.d, COALESCE(c.c, 0)::integer
  FROM date_series ds LEFT JOIN counts c ON c.d = ds.d
  ORDER BY ds.d;
END;
$function$;

-- Tabellenrechte
grant all on table public.stripe_prices, public.stripe_webhook_events, public.setup_tokens,
  public.ai_pricing, public.ai_usage_log, public.news_images, public.karussell_log,
  public.contact_submissions, public.analyse_stats_backup_20260913, public.analyse_stats_backup_20260914,
  public.backup_antonietta_runs_20260914, public.backup_antonietta_stats_20260914,
  public.backup_antonietta_ki_20260914, public.backup_antonietta_posts_20260914,
  public.legal_texts_backup_20260913, public.legal_texts_backup_20260914
  to anon, authenticated;
grant truncate on all tables in schema public to anon, authenticated;
grant delete on table public.users to anon, authenticated;

-- search_path (vorher nicht gesetzt)
alter function public.get_bio_views_today(uuid) reset search_path;
alter function public.sync_total_followers() reset search_path;
alter function public.increment_bio_view(uuid, date) reset search_path;
alter function public.update_updated_at() reset search_path;
alter function public.get_bio_views_last_7_days(uuid) reset search_path;
alter function public.normalize_niche_category() reset search_path;
alter function public.append_brand_trigger() reset search_path;
alter function public.check_biolink_max_links() reset search_path;
alter function public.get_platform_stats(uuid) reset search_path;
alter function public.get_biolink_views(uuid) reset search_path;
alter function public.record_consent(uuid, text, text, text, text, text) reset search_path;
alter function public.has_consent(uuid, text, text) reset search_path;
alter function public.ig_carousels_touch() reset search_path;
alter function public.newsletter_zeitstempel() reset search_path;
alter function public.nische_label(text) reset search_path;
alter function public.biolink_quelle(text) reset search_path;
alter function public.biolink_herkunft(integer) reset search_path;
alter function public.biolink_stunden(integer) reset search_path;
alter function public.biolink_klick_zahlen(integer) reset search_path;
alter function public.biolink_klickrate(integer) reset search_path;
alter function public.viuno_herkunft(text) reset search_path;

-- Vault-Funktionen und Schluessel (nur entfernen, wenn die Edge Functions wieder auf der alten Version laufen)
drop function if exists public.schluessel_pruefen(text, text);
drop function if exists public.schluessel_holen(text);
-- delete from vault.secrets where name in ('cron_schluessel', 'apify_webhook_schluessel');

-- 1c. Cron-Befehle (Stand vor dem 15.09.2026). Nur zusammen mit alten Function-Versionen sinnvoll.
select cron.alter_job(6, command := $cmd$
  SELECT net.http_post(
    url := 'https://bzejndghppuipnedasuv.supabase.co/functions/v1/generate-daily-digest',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$cmd$);
select cron.alter_job(16, command := $cmd$
  SELECT net.http_post(
    url := 'https://bzejndghppuipnedasuv.supabase.co/functions/v1/send-weekly-digest-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cmd$);
select cron.alter_job(21, command := $cmd$
  SELECT net.http_post(
    url := 'https://bzejndghppuipnedasuv.supabase.co/functions/v1/send-weekly-digest-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$cmd$);
-- Jobs 22 und 23 trugen den alten Token in der URL; der Token gilt als kompromittiert und wird nicht
-- wiederhergestellt. Bei Bedarf: cron.alter_job(22/23, command := ... '?schluessel=<neuer Wert>' ...).

-- 1d. digest_waechter ohne Vault-Header (Stand vor dem 15.09.2026)
create or replace function public.digest_waechter()
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  wochenstart date := date_trunc('week', current_date)::date;
  vorhanden int;
begin
  select count(*) into vorhanden from public.daily_digest where date = wochenstart;
  if vorhanden = 0 then
    perform public.log_error('digest-waechter',
      'Keine Ausgabe fuer die Woche ab ' || wochenstart || ' - der Montagslauf hat nichts geschrieben. Lauf wird nachgeholt.');
    perform net.http_post(
      url := 'https://bzejndghppuipnedasuv.supabase.co/functions/v1/generate-daily-digest',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb);
  end if;
end;
$function$;

-- =====================================================================
-- 2. Zahlung / Funktion
-- =====================================================================
-- Live-Preise in stripe_prices (angelegt 15.09.2026). Die Stripe-Preise selbst bleiben in Stripe
-- bestehen (Archivieren dort ist reversibel: Dashboard -> Produkt -> Preis -> aktivieren).
delete from public.stripe_prices where mode = 'live' and price_id in ('price_1UFkAqLH6NVqx26ev8jnPcG7', 'price_1UFkAtLH6NVqx26eRgc5bEqh');

-- users.last_active_at durfte vom Nutzer nicht geschrieben werden (Migration launch_check_users_last_active_at)
revoke update (last_active_at) on table public.users from authenticated;

-- =====================================================================
-- 3. Rechtstexte (Sicherung legal_texts_backup_20260915, angelegt VOR der Aenderung)
-- =====================================================================
update public.legal_texts t set
  agb = b.agb, impressum = b.impressum, datenschutz = b.datenschutz, widerruf = b.widerruf,
  biopage_terms = b.biopage_terms, mediakit_terms = b.mediakit_terms, updated_at = b.updated_at
from public.legal_texts_backup_20260915 b where b.id = t.id;

-- =====================================================================
-- Edge Functions: vorherige Versionen (Dashboard -> Edge Functions -> Function -> "Versionen")
-- =====================================================================
-- admin-tagesmail v2 -> v3 | apify-kosten-nachtragen v2 -> v3 | send-weekly-digest-email v12 -> v13
-- generate-daily-digest v54 -> v55 | analysis-webhook v22 -> v23 | start-analysis v11 -> v12
-- contact-submit v6 -> v7 | generate-biolink v17 -> v18 (lokales supabase-js, zu frueh) -> v19 (= v17 Inhalt)
-- stripe-webhook v8 -> v9 | send-purchase-confirmation v2 -> v3 | send-analysis-email v6 -> v7
-- Stubs (410): scan-managed-creator v9->10, fetch-competitor-accounts v6->7, competitor-webhook v6->7,
--   apify-webhook v53->54, fetch-analytics v54->55, send-collab-reply v32->33, newsletter-signup v6->7,
--   get-admin-stats v16->17, get-news-image v7->8, sync-news-images v7->8
-- Cron-Rollback (Abschnitt 1c) setzt die alten Function-Versionen voraus; die Stubs koennen
-- unabhaengig davon jederzeit auf die Vorversion zurueckgesetzt werden.

-- =====================================================================
-- 4. Indizes (Migration launch_check_indizes, Phase 4)
-- =====================================================================
drop index if exists public.admin_errors_user_id_idx, public.ai_usage_log_user_id_idx, public.analyse_freigaben_user_id_idx,
  public.analysis_purchases_analysis_run_id_idx, public.biolink_klicks_link_id_idx, public.brand_ratings_brand_id_idx,
  public.brand_ratings_deal_id_idx, public.brand_ratings_user_id_idx, public.brands_user_id_idx, public.deals_brand_id_idx,
  public.deals_user_id_idx, public.kosten_guthaben_erfasst_von_idx, public.mediakit_aufrufe_user_id_idx,
  public.newsletter_subscribers_user_id_idx, public.subscriptions_user_id_idx, public.user_goals_user_id_idx,
  public.users_active_goal_id_idx;
