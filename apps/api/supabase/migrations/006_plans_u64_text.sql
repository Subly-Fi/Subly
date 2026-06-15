-- 006_plans_u64_text.sql
--
-- plans.amount and plans.plan_id hold on-chain u64 values. Signed bigint tops out
-- at 9.2e18, but a u64 can reach 1.8e19 — so plan_id (and large token amounts)
-- overflowed bigint and the plan-sync upsert failed with
--   "value \"12237300979448208070\" is out of range for type bigint".
--
-- Store them as text (matching payments.amount / subscription_events.amount).
-- text is preferred over numeric here because PostgREST serializes numeric as a
-- JSON number, which would silently lose precision for u64 > 2^53 on the JS side.
-- The API parses these with BigInt()/parseFloat(), both of which accept strings.

alter table public.plans alter column amount type text using amount::text;
alter table public.plans alter column plan_id type text using plan_id::text;
