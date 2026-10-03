-- =====================================================================
-- Goat · borrar-datos.sql — BORRA TODOS LOS REGISTROS y deja la app en cero.
--
-- ⚠️ NO se puede deshacer. No confundir con schema.sql (ese crea las tablas).
--
-- Cómo usarlo: Supabase › SQL Editor › New query › pegar todo › Run
-- (Supabase pide confirmar porque es una operación destructiva).
--
-- Borra: gastos, comidas, estudio, gym, check-ins, tokens de atajos, log de la API.
--        El perfil vuelve a las metas de arranque.
-- Deja:  tu usuario (entras igual), las tablas, las reglas de seguridad (RLS) y los festivos.
-- =====================================================================

-- 1. Vaciar todas las tablas de Goat, menos festivos.
do $$
declare
  tabla text;
begin
  for tabla in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'festivos'
  loop
    execute format('truncate table public.%I restart identity cascade', tabla);
  end loop;
end
$$;

-- 2. Perfil nuevo con las metas de arranque para cada usuario.
insert into public.perfil (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- 3. Comprobación: todo en 0, salvo festivos y perfil (1 por usuario).
select tablename as tabla,
       (xpath('/row/n/text()',
              query_to_xml(format('select count(*) as n from public.%I', tablename), false, true, '')))[1]::text::int as filas
from pg_tables
where schemaname = 'public'
order by 1;
