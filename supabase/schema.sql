-- Chiang Rai FloodOps — Supabase schema
-- Run once in Supabase > SQL Editor on a new project.

create extension if not exists pgcrypto;

create type public.user_role as enum ('officer','provincial_admin','super_admin');
create type public.equipment_status as enum ('ready','deployed','maintenance','unavailable','unknown');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  official_code text not null unique check (official_code ~ '^\\d{8}$'),
  short_code text not null unique check (short_code ~ '^\\d{4}$'),
  name text not null,
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
  code text not null unique check (code ~ '^\\d{4}-\\d{4}$'),
  legacy_code text unique,
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

-- ตัวนับแยกตาม อปท. เลขที่ออกแล้วจะไม่ถูกลดหรือนำกลับมาใช้ใหม่
create table public.equipment_code_sequences (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  last_value integer not null default 0 check (last_value between 0 and 9999)
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

create or replace function public.assign_equipment_code()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_short_code text;
  v_next integer;
begin
  if new.code is not null and btrim(new.code) <> '' then
    return new;
  end if;

  select short_code into v_short_code
  from public.organizations where id=new.organization_id and active=true;
  if v_short_code is null then
    raise exception 'ไม่พบรหัสย่อของหน่วยงาน หรือหน่วยงานถูกระงับการใช้งาน';
  end if;

  insert into public.equipment_code_sequences(organization_id,last_value)
  values(new.organization_id,1)
  on conflict (organization_id) do update
    set last_value=public.equipment_code_sequences.last_value+1
  returning last_value into v_next;

  if v_next > 9999 then
    raise exception 'เลขลำดับอุปกรณ์ของหน่วยงาน % เกิน 9999 รายการ',v_short_code;
  end if;
  new.code := v_short_code || '-' || lpad(v_next::text,4,'0');
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
create trigger equipment_assign_code before insert on public.equipment for each row execute function public.assign_equipment_code();
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
alter table public.equipment_code_sequences enable row level security;
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
create policy "admins read equipment sequences" on public.equipment_code_sequences for select to authenticated using (public.is_system_admin());

-- มุมมองสาธารณะ: เปิดเฉพาะข้อมูลที่จำเป็นสำหรับแผนที่ ไม่เปิดข้อมูลติดต่อ หมายเหตุ หรือประวัติผู้แก้ไข
create view public.public_organizations with (security_barrier=true) as
select id,name,short_name,district,active from public.organizations where active=true;

create view public.public_equipment_types with (security_barrier=true) as
select id,name,icon from public.equipment_types where active=true;

create view public.public_equipment_map with (security_barrier=true) as
select id,code,name,equipment_type_id,organization_id,status,quantity,unit,
       latitude,longitude,basin,district,subdistrict,brand,registration_number,
       commissioned_at,last_inspected_at
from public.equipment;

revoke all on public.public_organizations,public.public_equipment_types,public.public_equipment_map from public;
grant select on public.public_organizations,public.public_equipment_types,public.public_equipment_map to anon,authenticated;

-- After creating the first user in Authentication, promote it once:
-- update public.profiles set role='super_admin', active=true where email='YOUR_ADMIN_EMAIL';

-- นำเข้า/แก้ไขอุปกรณ์จาก Excel แบบทั้งชุด (หากมีข้อผิดพลาดจะ rollback ทั้งชุด)



create or replace function public.import_equipment_batch(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_role public.user_role;
  v_user_org uuid;
  v_row jsonb;
  v_org_id uuid;
  v_type_id uuid;
  v_existing public.equipment%rowtype;
  v_status text;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  select role,organization_id into v_user_role,v_user_org
  from public.profiles
  where id=auth.uid() and active=true;

  if v_user_role is null then
    raise exception 'บัญชีไม่มีสิทธิ์นำเข้าข้อมูลหรือถูกระงับการใช้งาน';
  end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then
    raise exception 'ไม่พบรายการสำหรับนำเข้า';
  end if;
  if jsonb_array_length(p_rows)>1000 then
    raise exception 'นำเข้าได้สูงสุดครั้งละ 1,000 รายการ';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    select id into v_org_id
    from public.organizations
    where official_code=v_row->>'organization_code' and active=true;
    if v_org_id is null then
      raise exception 'ไม่พบรหัส อปท. %',coalesce(v_row->>'organization_code','(ว่าง)');
    end if;
    if v_user_role not in ('provincial_admin','super_admin') and v_org_id is distinct from v_user_org then
      raise exception 'ไม่มีสิทธิ์นำเข้าข้อมูลของ อปท. %',v_row->>'organization_code';
    end if;

    select id into v_type_id
    from public.equipment_types
    where name=v_row->>'equipment_type_name' and active=true;
    if v_type_id is null then
      raise exception 'ไม่พบประเภทอุปกรณ์ %',coalesce(v_row->>'equipment_type_name','(ว่าง)');
    end if;

    v_status:=v_row->>'status';
    if v_status is null or v_status not in ('ready','deployed','maintenance','unavailable','unknown') then
      raise exception 'สถานะอุปกรณ์ไม่ถูกต้อง';
    end if;
    if nullif(v_row->>'name','') is null or nullif(v_row->>'district','') is null then
      raise exception 'ชื่ออุปกรณ์และอำเภอห้ามว่าง';
    end if;
    if (v_row->>'quantity')::numeric<0 then raise exception 'จำนวนต้องไม่น้อยกว่า 0'; end if;
    if (v_row->>'latitude')::double precision not between -90 and 90 then raise exception 'ละติจูดไม่ถูกต้อง'; end if;
    if (v_row->>'longitude')::double precision not between -180 and 180 then raise exception 'ลองจิจูดไม่ถูกต้อง'; end if;

    if nullif(v_row->>'code','') is not null then
      select * into v_existing from public.equipment where code=v_row->>'code';
      if not found then raise exception 'ไม่พบรหัสอุปกรณ์ %',v_row->>'code'; end if;
      if v_existing.organization_id is distinct from v_org_id then
        raise exception 'ไม่อนุญาตให้เปลี่ยนหน่วยงานเจ้าของของอุปกรณ์ %',v_row->>'code';
      end if;
      if v_user_role not in ('provincial_admin','super_admin') and v_existing.organization_id is distinct from v_user_org then
        raise exception 'ไม่มีสิทธิ์แก้ไขอุปกรณ์ %',v_row->>'code';
      end if;

      update public.equipment set
        legacy_code=nullif(v_row->>'legacy_code',''), name=v_row->>'name',
        equipment_type_id=v_type_id, status=v_status::public.equipment_status,
        quantity=(v_row->>'quantity')::numeric, unit=coalesce(nullif(v_row->>'unit',''),'รายการ'),
        latitude=(v_row->>'latitude')::double precision, longitude=(v_row->>'longitude')::double precision,
        basin=nullif(v_row->>'basin',''), district=v_row->>'district',
        subdistrict=nullif(v_row->>'subdistrict',''), brand=nullif(v_row->>'brand',''),
        registration_number=nullif(v_row->>'registration_number',''),
        commissioned_at=nullif(v_row->>'commissioned_at','')::date,
        address=nullif(v_row->>'address',''), contact_name=nullif(v_row->>'contact_name',''),
        contact_phone=nullif(v_row->>'contact_phone',''),
        last_inspected_at=nullif(v_row->>'last_inspected_at','')::date,
        notes=nullif(v_row->>'notes','')
      where id=v_existing.id;
      v_updated:=v_updated+1;
    else
      insert into public.equipment(
        legacy_code,name,equipment_type_id,organization_id,status,quantity,unit,
        latitude,longitude,basin,district,subdistrict,brand,registration_number,
        commissioned_at,address,contact_name,contact_phone,last_inspected_at,notes
      ) values (
        nullif(v_row->>'legacy_code',''),v_row->>'name',v_type_id,v_org_id,v_status::public.equipment_status,
        (v_row->>'quantity')::numeric,coalesce(nullif(v_row->>'unit',''),'รายการ'),
        (v_row->>'latitude')::double precision,(v_row->>'longitude')::double precision,
        nullif(v_row->>'basin',''),v_row->>'district',nullif(v_row->>'subdistrict',''),
        nullif(v_row->>'brand',''),nullif(v_row->>'registration_number',''),
        nullif(v_row->>'commissioned_at','')::date,nullif(v_row->>'address',''),
        nullif(v_row->>'contact_name',''),nullif(v_row->>'contact_phone',''),
        nullif(v_row->>'last_inspected_at','')::date,nullif(v_row->>'notes','')
      );
      v_inserted:=v_inserted+1;
    end if;
  end loop;

  return jsonb_build_object('inserted',v_inserted,'updated',v_updated,'total',v_inserted+v_updated);
end
$$;

revoke all on function public.import_equipment_batch(jsonb) from public;
revoke all on function public.import_equipment_batch(jsonb) from anon;
grant execute on function public.import_equipment_batch(jsonb) to authenticated;
