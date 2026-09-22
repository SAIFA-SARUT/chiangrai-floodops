-- Chiang Rai FloodOps — Supabase schema
-- Run once in Supabase > SQL Editor on a new project.

create extension if not exists pgcrypto;

create type public.user_role as enum ('officer','provincial_admin','super_admin');
create type public.equipment_status as enum ('ready','deployed','maintenance','unavailable','unknown');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text not null,
  district text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  organization_id uuid references public.organizations(id),
  role public.user_role not null default 'officer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '●',
  active boolean not null default true
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  equipment_type_id uuid not null references public.equipment_types(id),
  organization_id uuid not null references public.organizations(id),
  status public.equipment_status not null default 'ready',
  quantity numeric(12,2) not null default 1 check (quantity >= 0),
  unit text not null default 'เครื่อง',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  basin text,
  address text,
  district text not null,
  subdistrict text,
  brand text,
  registration_number text,
  commissioned_at date,
  contact_name text,
  contact_phone text,
  last_inspected_at date,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index equipment_org_idx on public.equipment(organization_id);
create index equipment_type_idx on public.equipment(equipment_type_id);
create index equipment_status_idx on public.equipment(status);
create index equipment_location_idx on public.equipment(latitude,longitude);

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() and active=true $$;

create or replace function public.current_user_org()
returns uuid language sql stable security definer set search_path=public
as $$ select organization_id from public.profiles where id=auth.uid() and active=true $$;

create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_user_role() in ('provincial_admin','super_admin'),false) $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

create or replace function public.set_equipment_actor()
returns trigger language plpgsql as $$
begin
  new.updated_at=now(); new.updated_by=auth.uid();
  if tg_op='INSERT' then new.created_by=auth.uid(); end if;
  return new;
end $$;

create or replace function public.log_equipment_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(table_name,record_id,action,old_data,new_data,changed_by)
  values ('equipment',coalesce(new.id,old.id),tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end,auth.uid());
  return coalesce(new,old);
end $$;

create trigger organizations_touch before update on public.organizations for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger equipment_actor before insert or update on public.equipment for each row execute function public.set_equipment_actor();
create trigger equipment_audit after insert or update or delete on public.equipment for each row execute function public.log_equipment_change();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.equipment_types enable row level security;
alter table public.equipment enable row level security;
alter table public.audit_logs enable row level security;

create policy "authenticated read organizations" on public.organizations for select to authenticated using (true);
create policy "admins manage organizations" on public.organizations for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

create policy "authenticated read types" on public.equipment_types for select to authenticated using (true);
create policy "admins manage types" on public.equipment_types for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

create policy "users read own profile and admins read all" on public.profiles for select to authenticated using (id=auth.uid() or public.is_system_admin());
create policy "super admin updates profiles" on public.profiles for update to authenticated using (public.current_user_role()='super_admin') with check (public.current_user_role()='super_admin');

create policy "authenticated read equipment" on public.equipment for select to authenticated using (true);
create policy "staff insert own organization equipment" on public.equipment for insert to authenticated with check (public.is_system_admin() or organization_id=public.current_user_org());
create policy "staff update own organization equipment" on public.equipment for update to authenticated using (public.is_system_admin() or organization_id=public.current_user_org()) with check (public.is_system_admin() or organization_id=public.current_user_org());
create policy "staff delete own organization equipment" on public.equipment for delete to authenticated using (public.is_system_admin() or organization_id=public.current_user_org());

create policy "admins read audit logs" on public.audit_logs for select to authenticated using (public.is_system_admin());

-- After creating the first user in Authentication, promote it once:
-- update public.profiles set role='super_admin', active=true where email='YOUR_ADMIN_EMAIL';
