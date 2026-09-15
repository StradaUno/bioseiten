-- Launch-Check Phase 1 (15.09.2026). Angewendet ueber MCP als Migration
-- "launch_check_sicherheit_1". Rueckweg: ROLLBACK.sql Abschnitt 1.
-- Diese Datei ist die Repo-Kopie; die Datenbank hat sie bereits.

drop policy if exists "anon read creator_analytics" on public.creator_analytics;
drop policy if exists "service_all" on public.competitor_accounts;
drop policy if exists "mediakit_aufrufe_insert" on public.mediakit_aufrufe;
create policy "mediakit_aufrufe_insert" on public.mediakit_aufrufe
  for insert to anon, authenticated with check (public.is_mediakit_active(user_id));

revoke execute on function public.get_platform_stats(uuid) from public, anon, authenticated;
revoke execute on function public.get_bio_hourly_stats(uuid) from public, anon, authenticated;
revoke execute on function public.get_bio_referrer_stats(uuid) from public, anon, authenticated;
revoke execute on function public.get_bio_stats_flat(uuid) from public, anon, authenticated;
revoke execute on function public.get_bio_views_last_7_days(uuid) from public, anon, authenticated;
revoke execute on function public.get_bio_views_today(uuid) from public, anon, authenticated;
revoke execute on function public.get_biolink_views(uuid) from public, anon, authenticated;
revoke execute on function public.get_biolink_views_last_7_days_daily(uuid) from public, anon;
revoke execute on function public.track_bio_view(uuid) from public, anon, authenticated;
revoke execute on function public.track_bio_view(uuid, text) from public, anon, authenticated;
revoke execute on function public.increment_bio_view(uuid, date) from public, anon, authenticated;
revoke execute on function public.update_biolink_view_aggregates(uuid) from public, anon, authenticated;
revoke execute on function public.update_mediakit_view_aggregates(uuid) from public, anon, authenticated;
revoke execute on function public.record_consent(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.has_consent(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.log_error(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.purge_alte_analysedaten() from public, anon, authenticated;
revoke execute on function public.purge_abgelaufene_freigaben() from public, anon, authenticated;
revoke execute on function public.fail_stale_analysis_runs() from public, anon, authenticated;
revoke execute on function public.increment_blacklist_hit(text) from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.get_mediakit_views_last_7_days_daily(uuid) from public, anon;

create or replace function public.get_mediakit_views_last_7_days_daily(p_user_id uuid)
 returns table(view_date date, view_count integer)
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if p_user_id is distinct from auth.uid() then return; end if;
  return query
  with date_series as (
    select generate_series(current_date - interval '6 days', current_date, '1 day'::interval)::date as d
  ),
  counts as (
    select viewed_at::date as d, count(*)::integer as c
    from mediakit_aufrufe
    where user_id = p_user_id and viewed_at >= current_date - interval '6 days'
    group by viewed_at::date
  )
  select ds.d, coalesce(c.c, 0)::integer from date_series ds left join counts c on c.d = ds.d order by ds.d;
end;
$function$;

revoke all on table public.stripe_prices, public.stripe_webhook_events, public.setup_tokens,
  public.ai_pricing, public.ai_usage_log, public.news_images, public.karussell_log,
  public.contact_submissions, public.analyse_stats_backup_20260913, public.analyse_stats_backup_20260914,
  public.backup_antonietta_runs_20260914, public.backup_antonietta_stats_20260914,
  public.backup_antonietta_ki_20260914, public.backup_antonietta_posts_20260914,
  public.legal_texts_backup_20260913, public.legal_texts_backup_20260914
  from anon, authenticated;
revoke truncate on all tables in schema public from anon, authenticated;
revoke delete on table public.users from anon, authenticated;

alter function public.get_bio_views_today(uuid) set search_path = public;
alter function public.sync_total_followers() set search_path = public;
alter function public.increment_bio_view(uuid, date) set search_path = public;
alter function public.update_updated_at() set search_path = public;
alter function public.get_bio_views_last_7_days(uuid) set search_path = public;
alter function public.normalize_niche_category() set search_path = public;
alter function public.append_brand_trigger() set search_path = public;
alter function public.check_biolink_max_links() set search_path = public;
alter function public.get_platform_stats(uuid) set search_path = public;
alter function public.get_biolink_views(uuid) set search_path = public;
alter function public.record_consent(uuid, text, text, text, text, text) set search_path = public;
alter function public.has_consent(uuid, text, text) set search_path = public;
alter function public.ig_carousels_touch() set search_path = public;
alter function public.newsletter_zeitstempel() set search_path = public;
alter function public.nische_label(text) set search_path = public;
alter function public.biolink_quelle(text) set search_path = public;
alter function public.biolink_herkunft(integer) set search_path = public;
alter function public.biolink_stunden(integer) set search_path = public;
alter function public.biolink_klick_zahlen(integer) set search_path = public;
alter function public.biolink_klickrate(integer) set search_path = public;
alter function public.viuno_herkunft(text) set search_path = public;

-- Schluessel im Vault statt im Quelltext. Die Werte selbst wurden per
-- vault.create_secret(encode(gen_random_bytes(32),'hex'), 'cron_schluessel' / 'apify_webhook_schluessel')
-- angelegt und stehen nirgends im Repo.
create or replace function public.schluessel_pruefen(p_zweck text, p_wert text)
 returns boolean language sql security definer set search_path = ''
as $$
  select p_wert is not null and length(p_wert) >= 32 and exists (
    select 1 from vault.decrypted_secrets s where s.name = p_zweck and s.decrypted_secret = p_wert);
$$;
revoke all on function public.schluessel_pruefen(text, text) from public, anon, authenticated;
grant execute on function public.schluessel_pruefen(text, text) to service_role;

create or replace function public.schluessel_holen(p_zweck text)
 returns text language sql security definer set search_path = ''
as $$ select s.decrypted_secret from vault.decrypted_secrets s where s.name = p_zweck limit 1; $$;
revoke all on function public.schluessel_holen(text) from public, anon, authenticated;
grant execute on function public.schluessel_holen(text) to service_role;

-- digest_waechter und die Cron-Jobs 6/16/21/22/23 schicken den Schluessel im Header x-schluessel
-- (siehe cron.alter_job(...) in der Sitzung vom 15.09.2026; Befehle in ROLLBACK.sql 1c dokumentiert).
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
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-schluessel', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_schluessel')),
      body := '{}'::jsonb);
  end if;
end;
$function$;

-- users.last_active_at durfte vom Nutzer nicht geschrieben werden; merkeAktiv() scheiterte still.
grant update (last_active_at) on table public.users to authenticated;
