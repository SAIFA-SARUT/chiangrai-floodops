-- เปิดหน้าแผนที่ให้บุคคลทั่วไปดูได้โดยไม่ต้องเข้าสู่ระบบ
-- เปิดเฉพาะข้อมูลที่จำเป็นต่อแผนที่ ไม่เปิดเบอร์ติดต่อ ผู้ประสานงาน หมายเหตุ หรือข้อมูลผู้ใช้
begin;

create or replace view public.public_organizations with (security_barrier=true) as
select id,name,short_name,district,active
from public.organizations where active=true;

create or replace view public.public_equipment_types with (security_barrier=true) as
select id,name,icon
from public.equipment_types where active=true;

create or replace view public.public_equipment_map with (security_barrier=true) as
select id,code,name,equipment_type_id,organization_id,status,quantity,unit,
       latitude,longitude,basin,district,subdistrict,brand,registration_number,
       commissioned_at,last_inspected_at
from public.equipment;

revoke all on public.public_organizations,public.public_equipment_types,public.public_equipment_map from public;
grant select on public.public_organizations,public.public_equipment_types,public.public_equipment_map to anon,authenticated;

commit;

select count(*) as public_equipment from public.public_equipment_map;
