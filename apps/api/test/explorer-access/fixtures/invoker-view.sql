CREATE VIEW public.invoker_view WITH (security_invoker = true) AS SELECT id, role FROM public.users;
