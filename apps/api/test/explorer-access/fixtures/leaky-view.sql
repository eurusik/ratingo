CREATE VIEW public.leaky_view AS SELECT id, role FROM public.users;
CREATE VIEW public.leaky_bio_view AS SELECT id, bio AS about FROM public.users;
