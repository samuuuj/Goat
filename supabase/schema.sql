-- =====================================================================
-- Goat · schema.sql — TODA la base de datos en un solo archivo.
--
-- Cómo usarlo: Supabase › SQL Editor › New query › pegar todo › Run.
-- Se puede correr las veces que quieras: no borra datos ni duplica nada.
-- Al final muestra la lista de tablas con su protección (RLS) activada.
--
-- Reglas para cambiarlo (docs/SEGURIDAD.md y docs/SESIONES.md):
--   · Cada módulo es dueño de su sección. Los cambios se AGREGAN al final de su sección
--     (ej. alter table … add column if not exists …); no se reescribe lo que ya corrió.
--   · Toda tabla: user_id default auth.uid(), RLS activado, política "solo lo mío"
--     y ningún permiso para anon (el visitante sin sesión).
--   · Zona horaria del sistema: America/Bogota (UTC−5). El día termina a las 04:00.
-- =====================================================================


-- #####################################################################
-- 1. NÚCLEO · dueña: 00 · Central
-- #####################################################################

-- ---------------------------------------------------------------------
-- Día lógico: el día termina a las 04:00 en Bogotá.
-- Las 01:30 del 3 de octubre pertenecen al 2 de octubre.
-- Inmutable para usarla en columnas generadas:
--   fecha date generated always as (public.dia_logico(momento)) stored
-- Debe coincidir con diaLogico() de web/js/logica/dia.js.
-- ---------------------------------------------------------------------
create or replace function public.dia_logico(momento timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select ((momento at time zone 'America/Bogota') - interval '4 hours')::date
$$;

-- ---------------------------------------------------------------------
-- Perfil: una fila por usuario. Las metas las leen todos los módulos.
-- Metas de arranque hasta responder P-05 y P-06 (D-042).
-- ---------------------------------------------------------------------
create table if not exists public.perfil (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  nombre         text check (char_length(nombre) <= 60),
  metas          jsonb not null default
                   '{"kcal":2600,"proteina_g":130,"estudio_min_dia":120,"presupuesto_mensual":500000,"gym_semana":4}'::jsonb,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on column public.perfil.metas is
  'Metas diarias: kcal, proteina_g, estudio_min_dia, presupuesto_mensual (COP), gym_semana.';

-- ---------------------------------------------------------------------
-- Tokens para Atajos y Scriptable. Solo se guarda el hash SHA-256 (hex).
-- Se crean y revocan desde el servidor.
-- ---------------------------------------------------------------------
create table if not exists public.api_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nombre     text not null,                 -- "iPhone atajos", "Widget Scriptable"
  token_hash text not null unique,
  ultimo_uso timestamptz,
  revocado   boolean not null default false,
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani").
-- Calculados con la fecha de Pascua y el traslado al lunes siguiente.
-- 08 · Rutina se encarga de agregar los años siguientes.
-- ---------------------------------------------------------------------
create table if not exists public.festivos (
  fecha  date primary key,
  nombre text not null
);

insert into public.festivos (fecha, nombre) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-12', 'Reyes Magos'),
  ('2026-03-23', 'San José'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-05-18', 'Ascensión del Señor'),
  ('2026-06-08', 'Corpus Christi'),
  ('2026-06-15', 'Sagrado Corazón'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-20', 'Día de la Independencia'),
  ('2026-08-07', 'Batalla de Boyacá'),
  ('2026-08-17', 'Asunción de la Virgen'),
  ('2026-10-12', 'Día de la Raza'),
  ('2026-11-02', 'Todos los Santos'),
  ('2026-11-16', 'Independencia de Cartagena'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'),
  ('2027-01-11', 'Reyes Magos'),
  ('2027-03-22', 'San José'),
  ('2027-03-25', 'Jueves Santo'),
  ('2027-03-26', 'Viernes Santo'),
  ('2027-05-01', 'Día del Trabajo'),
  ('2027-05-10', 'Ascensión del Señor'),
  ('2027-05-31', 'Corpus Christi'),
  ('2027-06-07', 'Sagrado Corazón'),
  ('2027-07-05', 'San Pedro y San Pablo'),
  ('2027-07-20', 'Día de la Independencia'),
  ('2027-08-07', 'Batalla de Boyacá'),
  ('2027-08-16', 'Asunción de la Virgen'),
  ('2027-10-18', 'Día de la Raza'),
  ('2027-11-01', 'Todos los Santos'),
  ('2027-11-15', 'Independencia de Cartagena'),
  ('2027-12-08', 'Inmaculada Concepción'),
  ('2027-12-25', 'Navidad')
on conflict (fecha) do nothing;

-- Tipo de día básico. 08 · Rutina lo extiende con el horario de clases.
create or replace function public.tipo_dia_base(f date)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when exists (select 1 from public.festivos where fecha = f) then 'festivo'
    when extract(isodow from f) in (6, 7) then 'fin_de_semana'
    else 'habil'
  end
$$;

-- ---------------------------------------------------------------------
-- Check-ins: marcas explícitas que cuentan como registro.
--   nada_que_registrar → "no he gastado nada"
--   cierre             → "cierre de gastos del día hecho"
-- (Las comidas omitidas viven en la tabla comidas.)
-- ---------------------------------------------------------------------
create table if not exists public.checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  modulo     text not null check (modulo in ('finanzas','comidas','desbloqueo','sueno','ejercicio',
                                              'universidad','ocio','rutina','puntuacion','diario')),
  tipo       text not null check (tipo in ('nada_que_registrar','cierre')),
  clave      text check (char_length(clave) <= 60),
  detalle    jsonb not null default '{}'::jsonb,
  momento    timestamptz not null default now(),
  fecha      date generated always as (public.dia_logico(momento)) stored,
  origen     text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente uuid unique,
  creado_en  timestamptz not null default now()
);
create index if not exists checkins_user_fecha_idx on public.checkins (user_id, fecha);

-- ---------------------------------------------------------------------
-- Log de llamadas a la API (para depurar atajos). Purgar a los 30 días.
-- ---------------------------------------------------------------------
create table if not exists public.log_api (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  ruta        text not null,
  metodo      text not null,
  estado      int not null,
  duracion_ms int,
  cuerpo      jsonb,
  error       text,
  creado_en   timestamptz not null default now()
);
create index if not exists log_api_creado_en_idx on public.log_api (creado_en desc);

-- ---------------------------------------------------------------------
-- Perfil automático al crear un usuario, y fecha de actualización.
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfil (user_id) values (new.id) on conflict do nothing;
  return new;
end
$$;
-- Nadie la llama directo; solo el trigger.
revoke execute on function public.crear_perfil() from public, anon, authenticated;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Usuarios que ya existían (el que creaste en el panel de Supabase).
insert into public.perfil (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

drop trigger if exists perfil_actualizado_en on public.perfil;
create trigger perfil_actualizado_en
  before update on public.perfil
  for each row execute function public.tocar_actualizado_en();

-- ---------------------------------------------------------------------
-- Permisos del núcleo: anon nada; la sesión solo lo necesario.
-- ---------------------------------------------------------------------
revoke all on table public.perfil, public.api_tokens, public.festivos, public.checkins, public.log_api from anon, authenticated;

grant select, insert, update         on table public.perfil     to authenticated;
grant select                         on table public.api_tokens to authenticated;
grant select                         on table public.festivos   to authenticated;
grant select, insert, update, delete on table public.checkins   to authenticated;
grant select                         on table public.log_api    to authenticated;

alter table public.perfil     enable row level security;
alter table public.api_tokens enable row level security;
alter table public.festivos   enable row level security;
alter table public.checkins   enable row level security;
alter table public.log_api    enable row level security;

drop policy if exists perfil_propio on public.perfil;
create policy perfil_propio on public.perfil
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists tokens_ver_propios on public.api_tokens;
create policy tokens_ver_propios on public.api_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists festivos_lectura on public.festivos;
create policy festivos_lectura on public.festivos
  for select to authenticated
  using (true);

drop policy if exists checkins_propios on public.checkins;
create policy checkins_propios on public.checkins
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists log_api_ver_propio on public.log_api;
create policy log_api_ver_propio on public.log_api
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Ajustes personales (D-051): bienvenida, atajos listos, reglas del
-- desbloqueo… Cada módulo usa su propia clave de primer nivel.
-- ---------------------------------------------------------------------
alter table public.perfil add column if not exists ajustes jsonb not null default '{}'::jsonb;

-- Guarda una clave sin pisar las demás. Corre con los permisos de quien
-- la llama: RLS de perfil decide (solo tu fila).
create or replace function public.ajustes_poner(clave text, valor jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.perfil
     set ajustes = jsonb_set(coalesce(ajustes, '{}'::jsonb), array[clave], valor, true)
   where user_id = (select auth.uid())
     and char_length(clave) between 1 and 40;
$$;
revoke execute on function public.ajustes_poner(text, jsonb) from public, anon;
grant execute on function public.ajustes_poner(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Centro de notificaciones de la app (D-057). Sin montos (D-020).
-- clave evita duplicados ("racha:7:2026-10-03"); url solo rutas internas.
-- ---------------------------------------------------------------------
create table if not exists public.notificaciones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  modulo        text not null check (modulo in ('finanzas','comidas','desbloqueo','sueno','ejercicio','universidad',
                                                'ocio','rutina','puntuacion','diario','notificaciones','conectar')),
  emoji         text not null default '🔔' check (char_length(emoji) between 1 and 8),
  titulo        text not null check (char_length(titulo) between 1 and 60),
  cuerpo        text check (char_length(cuerpo) <= 160),
  url           text check (char_length(url) <= 200 and url !~ '^([a-zA-Z][a-zA-Z0-9+.-]*:|//)'),
  clave         text check (char_length(clave) <= 80),
  leida_en      timestamptz,
  descartada_en timestamptz,
  momento       timestamptz not null default now(),
  fecha         date generated always as (public.dia_logico(momento)) stored,
  origen        text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  creado_en     timestamptz not null default now(),
  unique (user_id, clave)
);
create index if not exists notificaciones_user_momento_idx on public.notificaciones (user_id, momento desc);

revoke all on table public.notificaciones from anon, authenticated;
grant select, insert, update, delete on table public.notificaciones to authenticated;
alter table public.notificaciones enable row level security;

drop policy if exists notificaciones_propias on public.notificaciones;
create policy notificaciones_propias on public.notificaciones
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- #####################################################################
-- 2. FINANZAS · dueña: 01 · Finanzas (v1 creada por Central, D-040)
-- Registro 100% manual (D-021). Montos en COP, enteros.
-- #####################################################################

create table if not exists public.finanzas_movimientos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('egreso','ingreso','transferencia')),
  monto       bigint not null check (monto > 0 and monto <= 100000000),
  categoria   text not null check (char_length(categoria) between 1 and 40),
  cuenta      text check (char_length(cuenta) <= 40),
  descripcion text check (char_length(descripcion) <= 200),
  momento     timestamptz not null default now(),
  fecha       date generated always as (public.dia_logico(momento)) stored,
  origen      text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente  uuid unique,
  creado_en   timestamptz not null default now()
);
create index if not exists finanzas_movimientos_user_fecha_idx on public.finanzas_movimientos (user_id, fecha);

revoke all on table public.finanzas_movimientos from anon, authenticated;
grant select, insert, update, delete on table public.finanzas_movimientos to authenticated;
alter table public.finanzas_movimientos enable row level security;

drop policy if exists finanzas_movimientos_propios on public.finanzas_movimientos;
create policy finanzas_movimientos_propios on public.finanzas_movimientos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- #####################################################################
-- 3. COMIDAS · dueña: 02 · Comidas (v1 creada por Central, D-040)
-- "No comí" se guarda como omitida = true: también es un registro.
-- #####################################################################

create table if not exists public.comidas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('desayuno','almuerzo','merienda','cena','snack')),
  descripcion text check (char_length(descripcion) <= 200),
  kcal        int check (kcal between 0 and 10000),
  proteina_g  numeric(6,1) check (proteina_g between 0 and 1000),
  fuente      text not null default 'manual' check (fuente in ('manual','frecuente','ia')),
  omitida     boolean not null default false,
  momento     timestamptz not null default now(),
  fecha       date generated always as (public.dia_logico(momento)) stored,
  origen      text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente  uuid unique,
  creado_en   timestamptz not null default now(),
  check (not omitida or (kcal is null and proteina_g is null))
);
create index if not exists comidas_user_fecha_idx on public.comidas (user_id, fecha);

revoke all on table public.comidas from anon, authenticated;
grant select, insert, update, delete on table public.comidas to authenticated;
alter table public.comidas enable row level security;

drop policy if exists comidas_propias on public.comidas;
create policy comidas_propias on public.comidas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- #####################################################################
-- 4. UNIVERSIDAD · dueña: 06 · Universidad (v1 creada por Central, D-040)
-- Minutos estudiados y materia como texto; con el horario (P-08) se pasa
-- a materias propias, inicio/fin y foco (docs/modulos/06-universidad.md).
-- #####################################################################

create table if not exists public.uni_sesiones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  materia    text not null check (char_length(materia) between 1 and 60),
  minutos    int not null check (minutos between 1 and 720),
  momento    timestamptz not null default now(),
  fecha      date generated always as (public.dia_logico(momento)) stored,
  origen     text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente uuid unique,
  creado_en  timestamptz not null default now()
);
create index if not exists uni_sesiones_user_fecha_idx on public.uni_sesiones (user_id, fecha);

revoke all on table public.uni_sesiones from anon, authenticated;
grant select, insert, update, delete on table public.uni_sesiones to authenticated;
alter table public.uni_sesiones enable row level security;

drop policy if exists uni_sesiones_propias on public.uni_sesiones;
create policy uni_sesiones_propias on public.uni_sesiones
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- #####################################################################
-- 5. EJERCICIO · dueña: 05 · Ejercicio (v1 creada por Central, D-040)
-- Qué rutina hiciste; series, pesos y progresión llegan con P-07.
-- #####################################################################

create table if not exists public.gym_sesiones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rutina     text not null check (char_length(rutina) between 1 and 40),
  notas      text check (char_length(notas) <= 500),
  momento    timestamptz not null default now(),
  fecha      date generated always as (public.dia_logico(momento)) stored,
  origen     text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente uuid unique,
  creado_en  timestamptz not null default now()
);
create index if not exists gym_sesiones_user_fecha_idx on public.gym_sesiones (user_id, fecha);

revoke all on table public.gym_sesiones from anon, authenticated;
grant select, insert, update, delete on table public.gym_sesiones to authenticated;
alter table public.gym_sesiones enable row level security;

drop policy if exists gym_sesiones_propias on public.gym_sesiones;
create policy gym_sesiones_propias on public.gym_sesiones
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- #####################################################################
-- 6. SUEÑO · dueña: 04 · Sueño (D-055)
-- Acostarse y despertar desde automatizaciones del iPhone + muestras de Salud.
-- #####################################################################



-- #####################################################################
-- 7. DESBLOQUEO · dueña: 03 · Desbloqueo (D-054)
-- Aperturas y cierres de apps, minutos ganados por puntaje y pases.
-- #####################################################################

-- ---------------------------------------------------------------------
-- Aperturas y cierres de apps (TikTok, Instagram, YouTube, juegos).
-- Los envían las automatizaciones "App › Se abre / Se cierra" del iPhone
-- (atajos "🔒 Puerta" y "🔓 Cerré app"). Compartida con Ocio (D-016).
--   app       → slug: 'tiktok', 'instagram', 'clash-royale'
--   permitido → lo que respondió la puerta al abrir (null si no pasó por ella)
-- Las reglas (minutos usados, ganados y restantes) viven en
-- web/js/desbloqueo/logica.js, no aquí.
-- ---------------------------------------------------------------------
create table if not exists public.apps_eventos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app        text not null check (char_length(app) <= 40 and app ~ '^[a-z0-9][a-z0-9-]*$'),
  evento     text not null check (evento in ('abrir','cerrar')),
  permitido  boolean,
  momento    timestamptz not null default now(),
  fecha      date generated always as (public.dia_logico(momento)) stored,
  origen     text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente uuid unique,
  creado_en  timestamptz not null default now()
);
create index if not exists apps_eventos_user_fecha_app_idx on public.apps_eventos (user_id, fecha, app);

revoke all on table public.apps_eventos from anon, authenticated;
grant select, insert, update, delete on table public.apps_eventos to authenticated;
alter table public.apps_eventos enable row level security;

drop policy if exists apps_eventos_propios on public.apps_eventos;
create policy apps_eventos_propios on public.apps_eventos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Pase de emergencia: 10 min extra para una app, UNO por día lógico.
-- El índice único (user_id, fecha) lo garantiza aunque lleguen dos a la vez.
-- ---------------------------------------------------------------------
create table if not exists public.desbloqueo_pases (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app        text not null check (char_length(app) <= 40 and app ~ '^[a-z0-9][a-z0-9-]*$'),
  minutos    int not null default 10 check (minutos between 1 and 30),
  momento    timestamptz not null default now(),
  fecha      date generated always as (public.dia_logico(momento)) stored,
  origen     text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente uuid unique,
  creado_en  timestamptz not null default now()
);
create unique index if not exists desbloqueo_pases_uno_por_dia_idx on public.desbloqueo_pases (user_id, fecha);

revoke all on table public.desbloqueo_pases from anon, authenticated;
grant select, insert, update, delete on table public.desbloqueo_pases to authenticated;
alter table public.desbloqueo_pases enable row level security;

drop policy if exists desbloqueo_pases_propios on public.desbloqueo_pases;
create policy desbloqueo_pases_propios on public.desbloqueo_pases
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- #####################################################################
-- 8. RUTINA · dueña: 08 · Rutina (D-056)
-- Plantilla semanal de bloques, chequeos hecho/saltado.
-- (Las tareas de la universidad van al final de la sección 4.)
-- #####################################################################



-- #####################################################################
-- 9. NOTIFICACIONES · dueña: 00 · Central (D-057)
-- La tabla vive en el núcleo; aquí solo lo extra de sus reglas.
-- #####################################################################



-- #####################################################################
-- Comprobación: todas las tablas deben salir con rls_activado = true.
-- #####################################################################
select c.relname as tabla, c.relrowsecurity as rls_activado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
