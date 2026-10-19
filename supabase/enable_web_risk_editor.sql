-- PDOSS: เปิดใช้การบันทึกประกาศพื้นที่เสี่ยงจากหน้าเว็บไซต์
-- ต้องรันหลัง 01_enable_admin_risk_system.sql และทะเบียน administrative_areas

begin;

create or replace function public.save_risk_declaration(p_payload jsonb)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_id uuid;
  v_org uuid;
  v_status public.risk_declaration_status;
  v_area_code text;
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;

  v_id := nullif(p_payload->>'id','')::uuid;
  v_org := nullif(p_payload->>'organization_id','')::uuid;
  v_status := coalesce(nullif(p_payload->>'status',''),'draft')::public.risk_declaration_status;
  v_area_code := nullif(p_payload->>'area_code','');

  if v_status not in ('draft','submitted') then
    raise exception 'หน้าเว็บไซต์บันทึกได้เฉพาะฉบับร่างหรือส่งอนุมัติ';
  end if;
  if v_area_code is null then raise exception 'กรุณาเลือกพื้นที่'; end if;

  if v_id is null then
    insert into public.risk_declarations(
      hazard_type_id,risk_level_id,title,description,recommendations,
      starts_at,ends_at,status,organization_id,created_by,submitted_at
    ) values (
      (p_payload->>'hazard_type_id')::uuid,(p_payload->>'risk_level_id')::smallint,
      p_payload->>'title',nullif(p_payload->>'description',''),nullif(p_payload->>'recommendations',''),
      (p_payload->>'starts_at')::timestamptz,nullif(p_payload->>'ends_at','')::timestamptz,
      v_status,v_org,auth.uid(),case when v_status='submitted' then now() end
    ) returning id into v_id;
  else
    update public.risk_declarations set
      hazard_type_id=(p_payload->>'hazard_type_id')::uuid,
      risk_level_id=(p_payload->>'risk_level_id')::smallint,
      title=p_payload->>'title',description=nullif(p_payload->>'description',''),
      recommendations=nullif(p_payload->>'recommendations',''),
      starts_at=(p_payload->>'starts_at')::timestamptz,
      ends_at=nullif(p_payload->>'ends_at','')::timestamptz,
      status=v_status,
      submitted_at=case when v_status='submitted' then coalesce(submitted_at,now()) else null end
    where id=v_id;
    if not found then raise exception 'ไม่พบประกาศหรือไม่มีสิทธิ์แก้ไข'; end if;
    delete from public.risk_declaration_areas where declaration_id=v_id;
  end if;

  insert into public.risk_declaration_areas(declaration_id,area_code)
  values (v_id,v_area_code);
  return v_id;
end
$$;

revoke all on function public.save_risk_declaration(jsonb) from public,anon;
grant execute on function public.save_risk_declaration(jsonb) to authenticated;

commit;

-- ตรวจจำนวนหน่วยงานที่ได้รับสิทธิ์จัดการพื้นที่แล้ว
select count(distinct organization_id) as organizations_with_area_permission
from public.organization_admin_areas
where can_manage_risk=true;
