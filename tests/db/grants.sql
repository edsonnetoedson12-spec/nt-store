-- Supabase concede estes privilégios por padrão no schema public; o RLS faz o filtro.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'dono@nt.com'),
  ('00000000-0000-0000-0000-0000000000bb', 'intruso@x.com');
insert into public.admins values ('00000000-0000-0000-0000-0000000000aa');
