CREATE TABLE public.leaky_probe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_email text,
  session_token text
);
