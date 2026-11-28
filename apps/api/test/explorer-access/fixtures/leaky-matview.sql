CREATE MATERIALIZED VIEW public.leaky_matview AS SELECT id, bio AS about FROM public.users;
