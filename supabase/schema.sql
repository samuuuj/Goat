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

-- ---------------------------------------------------------------------
-- Tareas de la universidad (G · Rutina, D-056). "Primer paso": la acción
-- más pequeña para empezar (vence la procrastinación).
-- ---------------------------------------------------------------------
create table if not exists public.uni_tareas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo       text not null check (char_length(titulo) between 1 and 120),
  materia      text check (char_length(materia) <= 60),
  fecha_limite timestamptz,
  estimado_min int check (estimado_min between 5 and 1440),
  estado       text not null default 'pendiente' check (estado in ('pendiente','en_progreso','hecha')),
  prioridad    smallint not null default 2 check (prioridad between 1 and 3),
  primer_paso  text check (char_length(primer_paso) <= 120),
  hecha_en     timestamptz,
  momento      timestamptz not null default now(),
  fecha        date generated always as (public.dia_logico(momento)) stored,
  origen       text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente   uuid unique,
  creado_en    timestamptz not null default now()
);
create index if not exists uni_tareas_user_estado_idx on public.uni_tareas (user_id, estado, fecha_limite);

revoke all on table public.uni_tareas from anon, authenticated;
grant select, insert, update, delete on table public.uni_tareas to authenticated;
alter table public.uni_tareas enable row level security;

drop policy if exists uni_tareas_propias on public.uni_tareas;
create policy uni_tareas_propias on public.uni_tareas
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

-- ---------------------------------------------------------------------
-- Ejercicio v2 (objetivo H, D-055): tipo, hora de inicio y fin, duración,
-- distancia, pasos y "entreno en curso" (cronómetro). Sin Apple Watch:
-- se registra con el atajo 🏋️ Entreno (empezar/terminar) o desde la web.
-- Caminata y trote no tienen rutina: `rutina` pasa a ser opcional.
-- ---------------------------------------------------------------------
alter table public.gym_sesiones add column if not exists tipo         text not null default 'fuerza';
alter table public.gym_sesiones add column if not exists inicio       timestamptz;
alter table public.gym_sesiones add column if not exists fin          timestamptz;
alter table public.gym_sesiones add column if not exists duracion_min int;
alter table public.gym_sesiones add column if not exists distancia_km numeric(5,2);
alter table public.gym_sesiones add column if not exists pasos        int;
alter table public.gym_sesiones add column if not exists en_curso     boolean not null default false;
alter table public.gym_sesiones alter column rutina drop not null;

alter table public.gym_sesiones drop constraint if exists gym_sesiones_tipo_check;
alter table public.gym_sesiones add constraint gym_sesiones_tipo_check
  check (tipo in ('fuerza','caminata','trote','cardio','deporte','movilidad','otro'));

-- Fin después del inicio y como mucho 6 horas después.
alter table public.gym_sesiones drop constraint if exists gym_sesiones_horario_check;
alter table public.gym_sesiones add constraint gym_sesiones_horario_check
  check (fin is null or (inicio is not null and fin > inicio and fin <= inicio + interval '6 hours'));

alter table public.gym_sesiones drop constraint if exists gym_sesiones_duracion_check;
alter table public.gym_sesiones add constraint gym_sesiones_duracion_check
  check (duracion_min is null or duracion_min between 1 and 600);

alter table public.gym_sesiones drop constraint if exists gym_sesiones_distancia_check;
alter table public.gym_sesiones add constraint gym_sesiones_distancia_check
  check (distancia_km is null or distancia_km between 0 and 100);

alter table public.gym_sesiones drop constraint if exists gym_sesiones_pasos_check;
alter table public.gym_sesiones add constraint gym_sesiones_pasos_check
  check (pasos is null or pasos between 0 and 100000);

-- Un entreno en curso tiene inicio y todavía no tiene fin.
alter table public.gym_sesiones drop constraint if exists gym_sesiones_en_curso_check;
alter table public.gym_sesiones add constraint gym_sesiones_en_curso_check
  check (not en_curso or (inicio is not null and fin is null));

-- Solo un entreno en curso a la vez por usuario.
create unique index if not exists gym_sesiones_un_en_curso_idx on public.gym_sesiones (user_id) where en_curso;

-- momento = inicio (así `fecha` es el día lógico en que empezó el entreno)
-- y duracion_min sale de inicio y fin. Igual que web/js/ejercicio/logica.js.
create or replace function public.gym_sesiones_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.inicio is not null then
    new.momento := new.inicio;
    if new.fin is not null then
      new.duracion_min := greatest(1, round(extract(epoch from (new.fin - new.inicio)) / 60)::int);
    end if;
  end if;
  return new;
end
$$;
-- Nadie la llama directo; solo el trigger.
revoke execute on function public.gym_sesiones_preparar() from public, anon, authenticated;

drop trigger if exists gym_sesiones_preparar on public.gym_sesiones;
create trigger gym_sesiones_preparar
  before insert or update on public.gym_sesiones
  for each row execute function public.gym_sesiones_preparar();

-- Antes "Cardio" era una rutina; ahora es un tipo.
update public.gym_sesiones set tipo = 'cardio'
 where rutina = 'cardio' and tipo = 'fuerza' and inicio is null;

-- ---------------------------------------------------------------------
-- Actividad del día desde Salud (atajo 📈 Actividad del día, 21:30).
-- El iPhone cuenta pasos y distancia sin Watch. Una fila por fecha:
-- el atajo puede correr varias veces y solo actualiza (upsert).
-- ---------------------------------------------------------------------
create table if not exists public.ejercicio_actividad (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha          date not null,
  pasos          int check (pasos between 0 and 200000),
  distancia_km   numeric(5,2) check (distancia_km between 0 and 300),
  energia_kcal   int check (energia_kcal between 0 and 20000),
  fuente         text not null default 'salud' check (fuente in ('salud','manual')),
  origen         text not null default 'atajo' check (origen in ('atajo','web','automatizacion','widget')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (user_id, fecha)
);

drop trigger if exists ejercicio_actividad_actualizado_en on public.ejercicio_actividad;
create trigger ejercicio_actividad_actualizado_en
  before update on public.ejercicio_actividad
  for each row execute function public.tocar_actualizado_en();

revoke all on table public.ejercicio_actividad from anon, authenticated;
grant select, insert, update, delete on table public.ejercicio_actividad to authenticated;
alter table public.ejercicio_actividad enable row level security;

drop policy if exists ejercicio_actividad_propia on public.ejercicio_actividad;
create policy ejercicio_actividad_propia on public.ejercicio_actividad
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- #####################################################################
-- 6. SUEÑO · dueña: 04 · Sueño (D-055)
-- Acostarse y despertar desde automatizaciones del iPhone + muestras de Salud.
-- #####################################################################

-- ---------------------------------------------------------------------
-- Eventos de la noche: "me acuesto" y "desperté". Llegan de los atajos
-- 🌙 y ☀️ (automatizaciones de Sueño, Modo Sueño, cargador, alarma) o
-- se anotan a mano en sueno.html. La noche se arma en
-- web/js/sueno/logica.js y pertenece al día lógico en que te acostaste.
-- ---------------------------------------------------------------------
create table if not exists public.sueno_eventos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo       text not null check (tipo in ('acostarse','despertar')),
  fuente     text not null default 'manual'
               check (fuente in ('hora_dormir','modo_sueno','cargador','alarma','despertar','manual')),
  momento    timestamptz not null default now(),
  fecha      date generated always as (public.dia_logico(momento)) stored,
  origen     text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente uuid unique,
  creado_en  timestamptz not null default now()
);
create index if not exists sueno_eventos_user_fecha_idx on public.sueno_eventos (user_id, fecha);
create index if not exists sueno_eventos_user_momento_idx on public.sueno_eventos (user_id, momento);

revoke all on table public.sueno_eventos from anon, authenticated;
grant select, insert, update, delete on table public.sueno_eventos to authenticated;
alter table public.sueno_eventos enable row level security;

drop policy if exists sueno_eventos_propios on public.sueno_eventos;
create policy sueno_eventos_propios on public.sueno_eventos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Muestras de Salud › Análisis del sueño ("En cama" sin Apple Watch).
-- Únicas por (user_id, inicio, tipo): sincronizar dos veces no duplica.
-- fecha = día lógico del inicio (una muestra de la 01:10 es de "ayer").
-- ---------------------------------------------------------------------
create table if not exists public.sueno_muestras (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  inicio     timestamptz not null,
  fin        timestamptz not null,
  tipo       text not null default 'en_cama' check (tipo in ('en_cama','dormido','despierto')),
  fuente     text not null default 'salud' check (fuente in ('salud','manual')),
  fecha      date generated always as (public.dia_logico(inicio)) stored,
  origen     text not null default 'atajo' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente uuid unique,
  creado_en  timestamptz not null default now(),
  constraint sueno_muestras_duracion check (fin > inicio and fin - inicio <= interval '16 hours'),
  constraint sueno_muestras_unica unique (user_id, inicio, tipo)
);
create index if not exists sueno_muestras_user_fecha_idx on public.sueno_muestras (user_id, fecha);

revoke all on table public.sueno_muestras from anon, authenticated;
grant select, insert, update, delete on table public.sueno_muestras to authenticated;
alter table public.sueno_muestras enable row level security;

drop policy if exists sueno_muestras_propias on public.sueno_muestras;
create policy sueno_muestras_propias on public.sueno_muestras
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Metas de sueño (leídas con respaldo en web/js/sueno/logica.js):
--   perfil.metas.sueno_horas (7.5) · hora_despertar ("06:00") · hora_acostarse ("22:30").
-- No se escriben aquí para no pisar las metas que ya tengas.



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

-- ---------------------------------------------------------------------
-- Plantilla semanal: cada bloque se repite los días que diga `dias`
-- (1 = lunes … 7 = domingo). Los festivos usan los bloques del domingo.
-- Es plantilla: no tiene fecha. "Borrar" un bloque = activo false
-- (así no se pierden sus chequeos pasados).
-- ---------------------------------------------------------------------
create table if not exists public.rutina_bloques (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo         text not null check (char_length(titulo) between 1 and 60),
  tipo           text not null check (tipo in ('despertar','caminar','desayuno','trabajo','descanso','almuerzo',
                                               'ejercicio','cena','estudio','clase_presencial','clase_virtual',
                                               'trabajo_uni','dormir','libre','otro')),
  dias           smallint[] not null check (cardinality(dias) between 1 and 7
                                            and dias <@ array[1,2,3,4,5,6,7]::smallint[]),
  hora_inicio    time not null,
  duracion_min   int not null check (duracion_min between 5 and 600),
  obligatorio    boolean not null default false,
  aviso_min      int not null default 0 check (aviso_min between 0 and 120),
  lugar          text check (char_length(lugar) <= 80),
  enlace         text check (char_length(enlace) <= 300 and enlace ~ '^https://[^[:space:]]+$'),
  materia        text check (char_length(materia) <= 60),
  notas          text check (char_length(notas) <= 200),
  activo         boolean not null default true,
  orden          int not null default 0,
  origen         text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente     uuid unique,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- Para que un chequeo solo pueda apuntar a un bloque del mismo usuario.
  unique (id, user_id)
);
create index if not exists rutina_bloques_user_activo_idx on public.rutina_bloques (user_id, activo);

drop trigger if exists rutina_bloques_actualizado_en on public.rutina_bloques;
create trigger rutina_bloques_actualizado_en
  before update on public.rutina_bloques
  for each row execute function public.tocar_actualizado_en();

revoke all on table public.rutina_bloques from anon, authenticated;
grant select, insert, update, delete on table public.rutina_bloques to authenticated;
alter table public.rutina_bloques enable row level security;

drop policy if exists rutina_bloques_propios on public.rutina_bloques;
create policy rutina_bloques_propios on public.rutina_bloques
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Chequeos: "hecho" o "saltado" de un bloque en un día lógico.
-- Uno por bloque y fecha: marcar de nuevo actualiza (upsert).
-- "Saltado" también es un registro (principio 3: nunca incentivar mentir).
-- ---------------------------------------------------------------------
create table if not exists public.rutina_checks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bloque_id  uuid not null,
  fecha      date not null,
  estado     text not null check (estado in ('hecho','saltado')),
  nota       text check (char_length(nota) <= 120),
  momento    timestamptz not null default now(),
  origen     text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
  id_cliente uuid unique,
  creado_en  timestamptz not null default now(),
  unique (bloque_id, fecha),
  foreign key (bloque_id, user_id) references public.rutina_bloques (id, user_id) on delete cascade
);
create index if not exists rutina_checks_user_fecha_idx on public.rutina_checks (user_id, fecha);

revoke all on table public.rutina_checks from anon, authenticated;
grant select, insert, update, delete on table public.rutina_checks to authenticated;
alter table public.rutina_checks enable row level security;

drop policy if exists rutina_checks_propios on public.rutina_checks;
create policy rutina_checks_propios on public.rutina_checks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Festivos de 2028 (el núcleo trae 2026 y 2027; Rutina agrega los años
-- siguientes). Misma regla: Pascua + traslado al lunes (Ley Emiliani).
-- ---------------------------------------------------------------------
insert into public.festivos (fecha, nombre) values
  ('2028-01-01', 'Año Nuevo'),
  ('2028-01-10', 'Reyes Magos'),
  ('2028-03-20', 'San José'),
  ('2028-04-13', 'Jueves Santo'),
  ('2028-04-14', 'Viernes Santo'),
  ('2028-05-01', 'Día del Trabajo'),
  ('2028-05-29', 'Ascensión del Señor'),
  ('2028-06-19', 'Corpus Christi'),
  ('2028-06-26', 'Sagrado Corazón'),
  ('2028-07-03', 'San Pedro y San Pablo'),
  ('2028-07-20', 'Día de la Independencia'),
  ('2028-08-07', 'Batalla de Boyacá'),
  ('2028-08-21', 'Asunción de la Virgen'),
  ('2028-10-16', 'Día de la Raza'),
  ('2028-11-06', 'Todos los Santos'),
  ('2028-11-13', 'Independencia de Cartagena'),
  ('2028-12-08', 'Inmaculada Concepción'),
  ('2028-12-25', 'Navidad')
on conflict (fecha) do nothing;



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
