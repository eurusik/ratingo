CREATE TABLE public.deep_a (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.import_batches (id)
);
CREATE TABLE public.deep_b (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.deep_a (id)
);
CREATE TABLE public.deep_c (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.deep_b (id)
);
CREATE TABLE public.deep_d (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.deep_c (id)
);
CREATE TABLE public.deep_e (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.deep_d (id),
  topic varchar(100)
);
ALTER TABLE public.deep_a ADD COLUMN last_id uuid REFERENCES public.deep_e (id);
