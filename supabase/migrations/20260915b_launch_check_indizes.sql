-- Launch-Check Phase 4 (15.09.2026): Indizes fuer die 17 Fremdschluessel ohne Index
-- (Supabase Performance Advisor). Rueckweg: ROLLBACK.sql Abschnitt 4.
create index if not exists admin_errors_user_id_idx on public.admin_errors (user_id);
create index if not exists ai_usage_log_user_id_idx on public.ai_usage_log (user_id);
create index if not exists analyse_freigaben_user_id_idx on public.analyse_freigaben (user_id);
create index if not exists analysis_purchases_analysis_run_id_idx on public.analysis_purchases (analysis_run_id);
create index if not exists biolink_klicks_link_id_idx on public.biolink_klicks (link_id);
create index if not exists brand_ratings_brand_id_idx on public.brand_ratings (brand_id);
create index if not exists brand_ratings_deal_id_idx on public.brand_ratings (deal_id);
create index if not exists brand_ratings_user_id_idx on public.brand_ratings (user_id);
create index if not exists brands_user_id_idx on public.brands (user_id);
create index if not exists deals_brand_id_idx on public.deals (brand_id);
create index if not exists deals_user_id_idx on public.deals (user_id);
create index if not exists kosten_guthaben_erfasst_von_idx on public.kosten_guthaben (erfasst_von);
create index if not exists mediakit_aufrufe_user_id_idx on public.mediakit_aufrufe (user_id, viewed_at desc);
create index if not exists newsletter_subscribers_user_id_idx on public.newsletter_subscribers (user_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists user_goals_user_id_idx on public.user_goals (user_id);
create index if not exists users_active_goal_id_idx on public.users (active_goal_id);
