CREATE FUNCTION public.leaky_function() RETURNS text LANGUAGE sql SECURITY DEFINER AS 'SELECT email FROM public.users LIMIT 1';
