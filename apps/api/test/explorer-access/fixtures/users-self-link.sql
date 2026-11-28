ALTER TABLE public.users ADD COLUMN referred_by uuid REFERENCES public.users (id);
