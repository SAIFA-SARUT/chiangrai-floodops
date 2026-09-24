-- เปิดใช้งานการนำเข้า/แก้ไขอุปกรณ์จาก Excel แบบทั้งชุด
-- รันไฟล์นี้หนึ่งครั้งใน Supabase SQL Editor สำหรับฐานข้อมูลเดิม

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

