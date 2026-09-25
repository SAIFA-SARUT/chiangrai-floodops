-- อนุญาตให้เจ้าหน้าที่แก้ข้อมูลทั่วไปของ อปท. ตนเอง โดยไม่เปิดสิทธิ์แก้รหัสหน่วยงาน
-- รันไฟล์นี้หนึ่งครั้งใน Supabase SQL Editor

create or replace function public.update_my_organization(
  p_name text,
  p_short_name text,
  p_district text,
  p_phone text default null
)
returns public.organizations
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org_id uuid;
  v_result public.organizations;
begin
  select organization_id into v_org_id
  from public.profiles
  where id=auth.uid() and active=true and role='officer';

  if v_org_id is null then
    raise exception 'บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลหน่วยงาน';
  end if;
  if nullif(btrim(p_name),'') is null
     or nullif(btrim(p_short_name),'') is null
     or nullif(btrim(p_district),'') is null then
    raise exception 'ชื่อหน่วยงาน ชื่อย่อ และอำเภอห้ามว่าง';
  end if;

  update public.organizations
  set name=btrim(p_name),
      short_name=btrim(p_short_name),
      district=btrim(p_district),
      phone=nullif(btrim(coalesce(p_phone,'')),'')
  where id=v_org_id and active=true
  returning * into v_result;

  if v_result.id is null then
    raise exception 'ไม่พบหน่วยงานของบัญชีนี้ หรือหน่วยงานถูกระงับ';
  end if;
  return v_result;
end
$$;

revoke all on function public.update_my_organization(text,text,text,text) from public;
revoke all on function public.update_my_organization(text,text,text,text) from anon;
grant execute on function public.update_my_organization(text,text,text,text) to authenticated;

