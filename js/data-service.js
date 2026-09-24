import { APP_CONFIG, isSupabaseConfigured } from './config.js';
import { equipment as seedEquipment, organizations as seedOrganizations, equipmentTypes, profiles as seedProfiles } from './demo-data.js';

const STORAGE_KEY = 'floodops-demo-v3-real-data';

function demoDb() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  const initial = { equipment: seedEquipment, organizations: seedOrganizations, equipmentTypes, profiles: seedProfiles };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return structuredClone(initial);
}

function saveDemo(db) { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

export class DataService {
  constructor() { this.client = null; this.demo = !isSupabaseConfigured(); }

  async init() {
    if (!this.demo) {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      this.client = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return this;
  }

  async signIn(email, password) {
    if (this.demo) return { user: seedProfiles[0], profile: seedProfiles[0] };
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const profile = await this.getMyProfile(data.user.id);
    if (!profile?.active) throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
    return { user: data.user, profile };
  }

  async signOut() { if (!this.demo) await this.client.auth.signOut(); }

  async restoreSession() {
    if (this.demo) return null;
    const { data } = await this.client.auth.getSession();
    if (!data.session) return null;
    const profile = await this.getMyProfile(data.session.user.id);
    return profile ? { user: data.session.user, profile } : null;
  }

  async getMyProfile(id) {
    const { data, error } = await this.client.from('profiles').select('*, organizations(name,short_name)').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async loadAll() {
    if (this.demo) return demoDb();
    const [eq, org, types, profiles] = await Promise.all([
      this.client.from('equipment').select('*, organizations(name,short_name), equipment_types(name,icon)').order('updated_at', { ascending:false }),
      this.client.from('organizations').select('*').order('name'),
      this.client.from('equipment_types').select('*').order('name'),
      this.client.from('profiles').select('*, organizations(name,short_name)').order('full_name')
    ]);
    const firstError = [eq, org, types, profiles].find(r => r.error)?.error;
    if (firstError) throw firstError;
    return { equipment:eq.data, organizations:org.data, equipmentTypes:types.data, profiles:profiles.data };
  }

  async loadPublic() {
    if (this.demo) {
      const db=demoDb();
      return { equipment:db.equipment, organizations:db.organizations, equipmentTypes:db.equipmentTypes, profiles:[] };
    }
    const [eq,org,types]=await Promise.all([
      this.client.from('public_equipment_map').select('*').order('code'),
      this.client.from('public_organizations').select('*').order('name'),
      this.client.from('public_equipment_types').select('*').order('name')
    ]);
    const firstError=[eq,org,types].find(r=>r.error)?.error;
    if(firstError)throw firstError;
    return { equipment:eq.data,organizations:org.data,equipmentTypes:types.data,profiles:[] };
  }

  async saveEquipment(record) {
    if (this.demo) {
      const db = demoDb();
      if (!record.code) {
        const org = db.organizations.find(x => x.id === record.organization_id);
        if (!org?.short_code) throw new Error('ไม่พบรหัสย่อของหน่วยงาน');
        const last = db.equipment
          .filter(x => x.organization_id === record.organization_id && new RegExp(`^${org.short_code}-\\d{4}$`).test(x.code || ''))
          .reduce((max, x) => Math.max(max, Number(x.code.slice(-4))), 0);
        if (last >= 9999) throw new Error('เลขลำดับอุปกรณ์ของหน่วยงานครบ 9999 รายการแล้ว');
        record.code = `${org.short_code}-${String(last + 1).padStart(4, '0')}`;
      }
      const item = { ...record, id: record.id || crypto.randomUUID() };
      const idx = db.equipment.findIndex(x => x.id === item.id);
      idx >= 0 ? db.equipment.splice(idx, 1, item) : db.equipment.unshift(item);
      saveDemo(db); return item;
    }
    const { data, error } = await this.client.from('equipment').upsert(record).select().single();
    if (error) throw error; return data;
  }

  async deleteEquipment(id) {
    if (this.demo) { const db=demoDb(); db.equipment=db.equipment.filter(x=>x.id!==id); saveDemo(db); return; }
    const { error } = await this.client.from('equipment').delete().eq('id', id); if (error) throw error;
  }

  async importEquipmentBatch(rows) {
    if (this.demo) {
      const db=demoDb();let inserted=0,updated=0;
      for(const row of rows){
        const org=db.organizations.find(x=>x.official_code===row.organization_code),type=db.equipmentTypes.find(x=>x.name===row.equipment_type_name);
        if(!org||!type)throw new Error('ไม่พบหน่วยงานหรือประเภทอุปกรณ์ในข้อมูลนำเข้า');
        const payload={...row,organization_id:org.id,equipment_type_id:type.id};delete payload.organization_code;delete payload.equipment_type_name;
        if(payload.code){const idx=db.equipment.findIndex(x=>x.code===payload.code);if(idx<0)throw new Error(`ไม่พบรหัส ${payload.code}`);db.equipment[idx]={...db.equipment[idx],...payload};updated++;}
        else{
          const last=db.equipment.filter(x=>x.organization_id===org.id&&new RegExp(`^${org.short_code}-\\d{4}$`).test(x.code||'')).reduce((max,x)=>Math.max(max,Number(x.code.slice(-4))),0);
          if(last>=9999)throw new Error(`เลขลำดับอุปกรณ์ของ ${org.name} ครบ 9999 รายการแล้ว`);
          db.equipment.unshift({...payload,id:crypto.randomUUID(),code:`${org.short_code}-${String(last+1).padStart(4,'0')}`});inserted++;
        }
      }
      saveDemo(db);return {inserted,updated,total:inserted+updated};
    }
    const { data,error }=await this.client.rpc('import_equipment_batch',{p_rows:rows});
    if(error)throw error;return data;
  }

  async saveOrganization(record) {
    if (this.demo) {
      const db=demoDb(); const item={...record,id:record.id||crypto.randomUUID(),active:true};
      const idx=db.organizations.findIndex(x=>x.id===item.id); idx>=0?db.organizations.splice(idx,1,item):db.organizations.push(item); saveDemo(db); return item;
    }
    const { data,error }=await this.client.from('organizations').upsert(record).select().single(); if(error)throw error; return data;
  }

  async saveProfile(record) {
    if (this.demo) { const db=demoDb(); const idx=db.profiles.findIndex(x=>x.id===record.id); if(idx>=0)db.profiles.splice(idx,1,{...db.profiles[idx],...record}); saveDemo(db); return record; }
    const { data,error }=await this.client.from('profiles').update(record).eq('id',record.id).select().single(); if(error)throw error; return data;
  }
}
