import { APP_CONFIG, isSupabaseConfigured } from './config.js';
import { DataService } from './data-service.js';

const service = await new DataService().init();
const state = { data:{equipment:[],organizations:[],equipmentTypes:[],profiles:[]}, profile:null, chart:null, map:null, baseLayers:null, currentBaseLayer:null, markers:null, boundary:null, searchPoint:null, searchCircle:null, searchMarker:null, searchSource:null, equipmentPage:1, equipmentPageSize:20, importRows:[] };
const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];
const statusMeta = {
  ready:{label:'พร้อมใช้งาน',class:'ready'}, deployed:{label:'อยู่ระหว่างใช้งาน',class:'deployed'},
  maintenance:{label:'อยู่ระหว่างซ่อมบำรุง',class:'maintenance'}, unavailable:{label:'ไม่พร้อมใช้งาน',class:'unavailable'}, unknown:{label:'ไม่ทราบสถานะ',class:'unknown'}
};
const roleLabel = { officer:'เจ้าหน้าที่ อปท.', provincial_admin:'แอดมินจังหวัด', super_admin:'Super Admin' };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const getOrg = id => state.data.organizations.find(x=>x.id===id);
const getType = id => state.data.equipmentTypes.find(x=>x.id===id);
const canManageAll = () => ['super_admin','provincial_admin'].includes(state.profile?.role);
const canEdit = item => canManageAll() || item.organization_id === state.profile?.organization_id;

function toast(message, tone='success') {
  const el=document.createElement('div'); el.className=`toast ${tone}`; el.textContent=message; $('#toast-root').append(el);
  setTimeout(()=>el.remove(),3500);
}

function setLoading(on=true) { document.body.classList.toggle('loading',on); }

async function boot() {
  const today=new Intl.DateTimeFormat('th-TH',{dateStyle:'long'}).format(new Date());
  $('#today-label').textContent=today;$('#map-date-label').textContent=today;$$('[data-current-date]').forEach(el=>el.textContent=today);
  bindGlobalEvents();
  if (isSupabaseConfigured()) {
    const session = await service.restoreSession().catch(()=>null);
    session ? await enterApp(session.profile) : await enterPublic();
  } else await enterPublic();
}

function showLogin(demoAvailable=false) {
  $('#login-screen').classList.remove('hidden'); $('#app-shell').classList.add('hidden');
  $('#demo-login').classList.toggle('hidden',!APP_CONFIG.demoMode);
  $('#config-hint').textContent = demoAvailable ? 'ยังไม่ได้ตั้งค่า Supabase — สามารถทดลองระบบด้วยข้อมูลตัวอย่างได้' : '';
}

async function enterApp(profile) {
  state.profile=profile;
  $('#login-screen').classList.add('hidden'); $('#app-shell').classList.remove('hidden');
  $('#logout-btn').title='ออกจากระบบ';$('#logout-btn').innerHTML='<span aria-hidden="true">↪</span><span>ออกจากระบบ</span>';
  $('#user-name').textContent=profile.full_name||profile.email;
  $('#user-org').textContent=profile.organizations?.short_name||getOrg(profile.organization_id)?.short_name||roleLabel[profile.role];
  $('#user-avatar').textContent=(profile.full_name||'ผู้ใช้').split(' ').map(x=>x[0]).slice(0,2).join('');
  document.body.dataset.role=profile.role;
  const connection=$('#connection-status'); connection.className=`connection-pill ${service.demo?'demo':'online'}`;
  connection.innerHTML=`<i></i><span>${service.demo?'โหมดสาธิต':'เชื่อมต่อ Supabase แล้ว'}</span>`;
  await reloadData();
}

async function enterPublic(){
  state.profile={role:'public',full_name:'ผู้ใช้งานทั่วไป'};
  $('#login-screen').classList.add('hidden');$('#app-shell').classList.remove('hidden');
  $('#user-name').textContent='ผู้ใช้งานทั่วไป';$('#user-org').textContent='ดูข้อมูลสาธารณะ';$('#user-avatar').textContent='ผู้ชม';
  $('#logout-btn').title='เข้าสู่ระบบเจ้าหน้าที่';$('#logout-btn').innerHTML='<span aria-hidden="true">⇥</span><span>เข้าสู่ระบบ</span>';
  document.body.dataset.role='public';
  const connection=$('#connection-status');connection.className=`connection-pill ${service.demo?'demo':'online'}`;
  connection.innerHTML=`<i></i><span>${service.demo?'ข้อมูลสาธิต':'ข้อมูลสาธารณะ'}</span>`;
  setLoading(true);
  try{state.data=await service.loadPublic();renderAll();switchView('map');}
  catch(err){console.error(err);toast(`โหลดแผนที่ไม่สำเร็จ: ${err.message}`,'error');showLogin(service.demo);}
  finally{setLoading(false);}
}

async function reloadData() {
  setLoading(true);
  try { state.data=state.profile?.role==='public'?await service.loadPublic():await service.loadAll(); renderAll(); }
  catch(err) { console.error(err); toast(`โหลดข้อมูลไม่สำเร็จ: ${err.message}`,'error'); }
  finally { setLoading(false); }
}

function bindGlobalEvents() {
  $('#login-form').addEventListener('submit',async e=>{ e.preventDefault(); setLoading(true); try{const r=await service.signIn($('#login-email').value,$('#login-password').value);await enterApp(r.profile);}catch(err){toast(err.message,'error');}finally{setLoading(false);} });
  $('#demo-login').addEventListener('click',()=>enterApp({id:'demo-admin',full_name:'ผู้ดูแลระบบจังหวัด',email:'demo@example.com',role:'super_admin',organization_id:'org-1'}));
  $('#public-map').addEventListener('click',enterPublic);
  $('#logout-btn').addEventListener('click',async()=>{if(state.profile?.role==='public'){showLogin(service.demo);return;}await service.signOut();location.reload();});
  $('#main-nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)switchView(b.dataset.view);});
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.go)));
  $$('[data-action="refresh"]').forEach(b=>b.addEventListener('click',reloadData));
  $$('[data-action="add-equipment"]').forEach(b=>b.addEventListener('click',()=>openEquipmentDialog()));
  $('[data-action="add-organization"]').addEventListener('click',()=>openOrganizationDialog());
  $('#mobile-menu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
  $('#entity-form').addEventListener('submit',handleDialogSubmit);
  $('#equipment-search').addEventListener('input',resetEquipmentPage);
  $('#equipment-type-filter').addEventListener('change',resetEquipmentPage);
  $('#equipment-basin-filter').addEventListener('change',resetEquipmentPage);
  $('#equipment-status-filter').addEventListener('change',resetEquipmentPage);
  $('#organization-search').addEventListener('input',renderOrganizations);
  $('#organization-district-filter').addEventListener('change',renderOrganizations);
  $('#map-search').addEventListener('input',renderMapMarkers);
  $('#map-basemap').addEventListener('change',e=>setBaseMap(e.target.value));
  $('#map-type-filter').addEventListener('change',renderMapMarkers);
  $('#map-basin-filter').addEventListener('change',renderMapMarkers);
  $('#map-status-filter').addEventListener('change',renderMapMarkers);
  $('#radius-input').addEventListener('change',()=>state.searchPoint&&findNearest(state.searchPoint,state.searchSource||'click'));
  $('#gps-search').addEventListener('click',useGps);
  $('#clear-map-search').addEventListener('click',clearMapSearch);
  $('#close-nearest').addEventListener('click',()=>$('#nearest-panel').classList.remove('open'));
  $('#export-equipment-csv').addEventListener('click',()=>exportEquipment('csv'));
  $('#export-equipment-xlsx').addEventListener('click',()=>exportEquipment('xlsx'));
  $('#import-equipment-xlsx').addEventListener('click',openImportDialog);
  $('#download-import-template').addEventListener('click',downloadImportTemplate);
  $('#import-file').addEventListener('change',handleImportFile);
  $('#import-form').addEventListener('submit',confirmImport);
  $('#export-dashboard-png').addEventListener('click',()=>exportDashboard('png'));
  $('#export-dashboard-pdf').addEventListener('click',()=>exportDashboard('pdf'));
}

function switchView(name) {
  document.body.dataset.view=name;
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const titles={dashboard:['ศูนย์บัญชาการ','ภาพรวมสถานการณ์'],map:['แผนที่เชิงพื้นที่','ติดตามทรัพยากร'],equipment:['ทะเบียนทรัพยากร','คลังอุปกรณ์'],organizations:['การบริหารระบบ','หน่วยงาน อปท.'],users:['การบริหารระบบ','ผู้ใช้งานและสิทธิ์']};
  $('#page-kicker').textContent=titles[name][0]; $('#page-title').textContent=titles[name][1];
  $('.sidebar').classList.remove('open');
  if(name==='map'){initMap();setTimeout(()=>state.map.invalidateSize(),80);renderMapMarkers();}
}

function renderAll() {
  fillFilters(); renderDashboard(); renderEquipment(); renderOrganizations(); renderUsers();
  if(state.map)renderMapMarkers();
}

function fillFilters() {
  ['#equipment-type-filter','#map-type-filter'].forEach(sel=>{const el=$(sel),v=el.value;el.innerHTML='<option value="">ทุกประเภท</option>'+state.data.equipmentTypes.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');el.value=v;});
  ['#equipment-status-filter','#map-status-filter'].forEach(sel=>{const el=$(sel),v=el.value;el.innerHTML='<option value="">ทุกสถานะ</option>'+Object.entries(statusMeta).map(([k,m])=>`<option value="${k}">${m.label}</option>`).join('');el.value=v;});
  const basins=[...new Set(state.data.equipment.map(x=>x.basin).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  ['#equipment-basin-filter','#map-basin-filter'].forEach(sel=>{const el=$(sel),v=el.value;el.innerHTML='<option value="">ทุกลุ่มน้ำ</option>'+basins.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');el.value=v;});
  const districts=[...new Set(state.data.organizations.map(x=>x.district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  const districtEl=$('#organization-district-filter'),districtValue=districtEl.value;
  districtEl.innerHTML='<option value="">ทุกอำเภอ</option>'+districts.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');districtEl.value=districtValue;
}

function renderDashboard() {
  const eq=state.data.equipment,total=eq.reduce((s,x)=>s+Number(x.quantity||1),0),ready=eq.filter(x=>x.status==='ready').reduce((s,x)=>s+Number(x.quantity||1),0),attention=eq.filter(x=>['maintenance','unavailable','unknown'].includes(x.status)).length;
  const stats=[['ทะเบียนอุปกรณ์',total.toLocaleString('th-TH'),'รายการทั้งหมด','blue'],['พร้อมใช้งาน',ready.toLocaleString('th-TH'),`${total?Math.round(ready/total*100):0}% ของทั้งหมด`,'green'],['หน่วยงานในระบบ',state.data.organizations.filter(x=>x.active!==false).length,'องค์กรปกครองส่วนท้องถิ่น','navy'],['ต้องดำเนินการ',attention,'ซ่อมบำรุงหรือไม่พร้อมใช้','orange']];
  $('#stat-grid').innerHTML=stats.map(([l,v,s,c])=>`<article class="stat-card ${c}"><span>${l}</span><strong>${v}</strong><small>${s}</small></article>`).join('');
  const counts=Object.keys(statusMeta).map(k=>({key:k,count:eq.filter(x=>x.status===k).reduce((s,x)=>s+Number(x.quantity||1),0)}));
  $('#status-breakdown').innerHTML=counts.map(x=>`<div class="status-row"><div><i class="dot ${x.key}"></i><span>${statusMeta[x.key].label}</span></div><b>${x.count}</b><progress value="${x.count}" max="${Math.max(total,1)}"></progress></div>`).join('');
  const flagged=eq.filter(x=>['maintenance','unavailable','unknown'].includes(x.status)).slice(0,6);
  $('#attention-table').innerHTML=table(['อุปกรณ์','หน่วยงาน','ตรวจล่าสุด','สถานะ'],flagged.map(x=>[equipmentCell(x),esc(getOrg(x.organization_id)?.short_name||'-'),formatDate(x.last_inspected_at),statusBadge(x.status)]),'ไม่มีรายการที่ต้องดำเนินการ');
  renderChart();
}

function renderChart() {
  const ranked=state.data.equipmentTypes.map(t=>({name:t.name,value:state.data.equipment.filter(x=>x.equipment_type_id===t.id).reduce((s,x)=>s+Number(x.quantity||1),0)})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'th')),labels=ranked.map(x=>x.name),values=ranked.map(x=>x.value);
  if(state.chart)state.chart.destroy();
  $('#type-chart').parentElement.style.height=`${Math.max(420,ranked.length*38)}px`;
  const valueLabels={id:'horizontalValueLabels',afterDatasetsDraw(chart){const {ctx}=chart,meta=chart.getDatasetMeta(0);ctx.save();ctx.fillStyle='#526573';ctx.font='600 11px Noto Sans Thai';ctx.textBaseline='middle';meta.data.forEach((bar,i)=>ctx.fillText(values[i].toLocaleString('th-TH'),bar.x+7,bar.y));ctx.restore();}};
  state.chart=new Chart($('#type-chart'),{type:'bar',data:{labels,datasets:[{data:values,backgroundColor:ranked.map((_,i)=>['#7c3aed','#db2777','#0b6bcb','#18a999','#f59e0b','#ea5b3d'][i%6]),borderRadius:7,barThickness:20}]},plugins:[valueLabels],options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,layout:{padding:{right:42}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${Number(c.raw).toLocaleString('th-TH')} รายการ`}}},scales:{x:{beginAtZero:true,grid:{color:'#edf1f5'},ticks:{precision:0}},y:{grid:{display:false},ticks:{font:{family:'Noto Sans Thai',size:11},autoSkip:false}}}}});
}

function getFilteredEquipment() {
  const q=$('#equipment-search').value.trim().toLowerCase(),basin=$('#equipment-basin-filter').value,type=$('#equipment-type-filter').value,status=$('#equipment-status-filter').value;
  return state.data.equipment.filter(x=>{const org=getOrg(x.organization_id);return(!q||[x.code,x.name,x.district,x.subdistrict,x.brand,x.registration_number,org?.name,org?.short_name].join(' ').toLowerCase().includes(q))&&(!basin||x.basin===basin)&&(!type||x.equipment_type_id===type)&&(!status||x.status===status);});
}

function renderEquipment() {
  const rows=getFilteredEquipment();
  const totalPages=Math.max(1,Math.ceil(rows.length/state.equipmentPageSize));
  state.equipmentPage=Math.min(Math.max(1,state.equipmentPage),totalPages);
  const start=(state.equipmentPage-1)*state.equipmentPageSize,end=Math.min(start+state.equipmentPageSize,rows.length),pageRows=rows.slice(start,end);
  $('#equipment-table').innerHTML=table(['รหัส / อุปกรณ์','ประเภท','หน่วยงาน / พื้นที่','ทะเบียน / ยี่ห้อ','สถานะ',''],pageRows.map(x=>[equipmentCell(x),esc(getType(x.equipment_type_id)?.name||'-'),`<b>${esc(getOrg(x.organization_id)?.short_name||'-')}</b><small>${esc(x.subdistrict||'-')} · ${esc(x.district||'')}</small>`,`<b>${esc(x.registration_number||'-')}</b><small>${esc(x.brand||'-')}</small>`,statusBadge(x.status),canEdit(x)?`<button class="row-action" data-edit="${x.id}">แก้ไข</button>`:'']), 'ไม่พบข้อมูลอุปกรณ์');
  $('#equipment-count').textContent=rows.length?`แสดง ${(start+1).toLocaleString('th-TH')}–${end.toLocaleString('th-TH')} จาก ${rows.length.toLocaleString('th-TH')} รายการ`:'ไม่พบข้อมูลตามตัวกรอง';
  renderEquipmentPagination(totalPages);
  $$('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEquipmentDialog(state.data.equipment.find(x=>x.id===b.dataset.edit))));
}

function resetEquipmentPage(){state.equipmentPage=1;renderEquipment();}
function renderEquipmentPagination(totalPages){
  const pages=[];
  for(let p=1;p<=totalPages;p++)if(p===1||p===totalPages||Math.abs(p-state.equipmentPage)<=1)pages.push(p);
  let last=0,html=`<button class="page-btn" data-equipment-page="${state.equipmentPage-1}" ${state.equipmentPage===1?'disabled':''}>ก่อนหน้า</button>`;
  pages.forEach(p=>{if(last&&p-last>1)html+='<span class="page-gap">…</span>';html+=`<button class="page-btn ${p===state.equipmentPage?'active':''}" data-equipment-page="${p}" ${p===state.equipmentPage?'aria-current="page"':''}>${p.toLocaleString('th-TH')}</button>`;last=p;});
  html+=`<button class="page-btn" data-equipment-page="${state.equipmentPage+1}" ${state.equipmentPage===totalPages?'disabled':''}>ถัดไป</button>`;
  $('#equipment-pagination').innerHTML=totalPages>1?html:'';
  $$('[data-equipment-page]').forEach(b=>b.addEventListener('click',()=>{state.equipmentPage=Number(b.dataset.equipmentPage);renderEquipment();$('#view-equipment').scrollIntoView({behavior:'smooth',block:'start'});}));
}

function renderOrganizations() {
  const q=$('#organization-search').value.trim().toLowerCase(),selectedDistrict=$('#organization-district-filter').value;
  const organizations=state.data.organizations.filter(o=>(!selectedDistrict||o.district===selectedDistrict)&&(!q||[o.name,o.short_name,o.official_code,o.short_code,o.district].join(' ').toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'th'));
  const groups=Map.groupBy?Map.groupBy(organizations,o=>o.district||'ไม่ระบุอำเภอ'):organizations.reduce((m,o)=>{const key=o.district||'ไม่ระบุอำเภอ';if(!m.has(key))m.set(key,[]);m.get(key).push(o);return m;},new Map());
  $('#organization-grid').innerHTML=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'th')).map(([district,orgs])=>`<section class="org-district"><div class="org-district-head"><h3>${esc(district)}</h3><span>${orgs.length.toLocaleString('th-TH')} หน่วยงาน</span></div><div class="organization-grid">${orgs.map(o=>{const items=state.data.equipment.filter(x=>x.organization_id===o.id),ready=items.filter(x=>x.status==='ready').length;return `<article class="org-card"><div class="org-icon">${esc(o.short_code||o.short_name?.slice(0,3)||'อปท.')}</div><div class="org-main"><h3>${esc(o.name)}</h3><p>รหัส ${esc(o.official_code||'-')} · ${esc(o.district)} · ${esc(o.phone||'ไม่ระบุโทรศัพท์')}</p><div><span><b>${items.length}</b> รายการ</span><span class="ready-text"><b>${ready}</b> พร้อมใช้</span></div></div><div class="org-actions"><button class="row-action view-org" data-view-org="${o.id}">ดูข้อมูล</button><button class="row-action" data-edit-org="${o.id}">แก้ไข</button></div></article>`;}).join('')}</div></section>`).join('')||'<div class="empty">ไม่พบหน่วยงานตามเงื่อนไข</div>';
  $$('[data-view-org]').forEach(b=>b.addEventListener('click',()=>openOrganizationDetail(state.data.organizations.find(x=>x.id===b.dataset.viewOrg))));
  $$('[data-edit-org]').forEach(b=>b.addEventListener('click',()=>openOrganizationDialog(state.data.organizations.find(x=>x.id===b.dataset.editOrg))));
}

function openOrganizationDetail(org){
  const items=state.data.equipment.filter(x=>x.organization_id===org.id),statusCounts=Object.fromEntries(Object.keys(statusMeta).map(key=>[key,items.filter(x=>x.status===key).length]));
  const typeCounts=state.data.equipmentTypes.map(t=>({name:t.name,count:items.filter(x=>x.equipment_type_id===t.id).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count);
  $('#organization-detail-title').textContent=org.name;
  $('#organization-detail-body').innerHTML=`<div class="org-detail-meta"><div><span>รหัส อปท.</span><b>${esc(org.official_code||'-')}</b></div><div><span>อำเภอ</span><b>${esc(org.district||'-')}</b></div><div><span>โทรศัพท์</span><b>${esc(org.phone||'ไม่ระบุ')}</b></div></div><div class="org-detail-stats"><div class="org-detail-stat"><span>ทั้งหมด</span><strong>${items.length.toLocaleString('th-TH')}</strong></div>${Object.keys(statusMeta).map(key=>`<div class="org-detail-stat"><span>${esc(statusMeta[key].label)}</span><strong>${statusCounts[key].toLocaleString('th-TH')}</strong></div>`).join('')}</div><div class="org-type-list">${typeCounts.length?typeCounts.map(x=>`<span>${esc(x.name)} <b>${x.count.toLocaleString('th-TH')}</b></span>`).join(''):'<span>ยังไม่มีอุปกรณ์</span>'}</div><div class="table-wrap">${table(['รหัส / อุปกรณ์','ประเภท','พื้นที่','สถานะ'],items.map(x=>[equipmentCell(x),esc(getType(x.equipment_type_id)?.name||'-'),`${esc(x.subdistrict||'-')} · ${esc(x.district||'-')}`,statusBadge(x.status)]),'ยังไม่มีข้อมูลอุปกรณ์')}</div>`;
  $('#organization-map-button').disabled=!items.length;
  $('#organization-map-button').onclick=()=>{const dialog=$('#organization-detail-dialog');dialog.close();$('#map-search').value=org.name;switchView('map');setTimeout(renderMapMarkers,100);};
  $('#organization-detail-dialog').showModal();
}

function renderUsers() {
  $('#users-table').innerHTML=table(['ชื่อผู้ใช้งาน','อีเมล','หน่วยงาน','บทบาท','สถานะ',''],state.data.profiles.map(p=>[`<b>${esc(p.full_name||'-')}</b>`,esc(p.email||'-'),esc(getOrg(p.organization_id)?.short_name||p.organizations?.short_name||'-'),`<span class="role-pill">${roleLabel[p.role]||p.role}</span>`,p.active!==false?'<span class="active-text">ใช้งาน</span>':'<span class="inactive-text">ระงับ',`<button class="row-action" data-edit-user="${p.id}">กำหนดสิทธิ์</button>`]),'ยังไม่มีบัญชีผู้ใช้');
  $$('[data-edit-user]').forEach(b=>b.addEventListener('click',()=>openUserDialog(state.data.profiles.find(x=>x.id===b.dataset.editUser))));
}

function table(headers,rows,empty) { if(!rows.length)return `<div class="empty">${empty}</div>`;return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
function equipmentCell(x){return `<b>${esc(x.name)}</b><small>${esc(x.code)}</small>`;}
function statusBadge(s){const m=statusMeta[s]||{label:s,class:''};return `<span class="status-badge ${m.class}"><i></i>${esc(m.label)}</span>`;}
function formatDate(v){return v?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium'}).format(new Date(v)):'-';}
function daysSince(v){return v?Math.floor((Date.now()-new Date(v).getTime())/86400000):999;}

function exportRows() {
  return getFilteredEquipment().map(x=>({
    'รหัสอุปกรณ์':x.code||'', 'รหัสเดิม':x.legacy_code||'', 'รหัส อปท.':getOrg(x.organization_id)?.official_code||'',
    'ประเภทอุปกรณ์':getType(x.equipment_type_id)?.name||'', 'ชื่ออุปกรณ์':x.name||'', 'สถานะ':statusMeta[x.status]?.label||x.status||'',
    'จำนวน':Number(x.quantity??1), 'หน่วยนับ':x.unit||'รายการ', 'ละติจูด':Number(x.latitude), 'ลองจิจูด':Number(x.longitude),
    'ลุ่มน้ำ':x.basin||'', 'อำเภอ':x.district||'', 'ตำบล':x.subdistrict||'', 'ยี่ห้อ':x.brand||'', 'ทะเบียนรถ':x.registration_number||'',
    'วันที่เริ่มใช้งาน':x.commissioned_at||'', 'สถานที่จัดเก็บ':x.address||'', 'ผู้ประสานงาน':x.contact_name||'',
    'เบอร์ติดต่อ':x.contact_phone||'', 'วันที่ตรวจล่าสุด':x.last_inspected_at||'', 'หมายเหตุ':x.notes||''
  }));
}

function dateStamp(){return new Date().toISOString().slice(0,10);}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function exportEquipment(format){
  const rows=exportRows();
  if(!rows.length)return toast('ไม่มีข้อมูลตามตัวกรองสำหรับส่งออก','error');
  try{
    if(format==='xlsx'){
      if(!window.XLSX)throw new Error('ไม่สามารถโหลดระบบสร้าง Excel');
      const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();
      ws['!cols']=Object.keys(rows[0]).map(h=>({wch:Math.max(13,h.length+4)}));
      XLSX.utils.book_append_sheet(wb,ws,'อุปกรณ์ป้องกันน้ำท่วม');
      XLSX.writeFile(wb,`flood-equipment-${dateStamp()}.xlsx`);
    }else{
      const headers=Object.keys(rows[0]),quote=v=>`"${String(v??'').replace(/"/g,'""')}"`;
      const csv='\ufeff'+[headers.map(quote).join(','),...rows.map(r=>headers.map(h=>quote(r[h])).join(','))].join('\r\n');
      downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`flood-equipment-${dateStamp()}.csv`);
    }
    toast(`ดาวน์โหลดข้อมูล ${rows.length.toLocaleString('th-TH')} รายการแล้ว`);
  }catch(err){toast(`สร้างไฟล์ไม่สำเร็จ: ${err.message}`,'error');}
}

const importHeaders=['รหัสอุปกรณ์','รหัสเดิม','รหัส อปท.','ประเภทอุปกรณ์','ชื่ออุปกรณ์','สถานะ','จำนวน','หน่วยนับ','ละติจูด','ลองจิจูด','ลุ่มน้ำ','อำเภอ','ตำบล','ยี่ห้อ','ทะเบียนรถ','วันที่เริ่มใช้งาน','สถานที่จัดเก็บ','ผู้ประสานงาน','เบอร์ติดต่อ','วันที่ตรวจล่าสุด','หมายเหตุ'];
const importStatus={...Object.fromEntries(Object.entries(statusMeta).map(([key,value])=>[value.label,key])),ready:'ready',deployed:'deployed',maintenance:'maintenance',unavailable:'unavailable',unknown:'unknown'};

function openImportDialog(){
  state.importRows=[];$('#import-file').value='';$('#import-summary').textContent='ยังไม่ได้เลือกไฟล์';$('#import-errors').classList.add('hidden');$('#import-errors').innerHTML='';$('#import-preview').innerHTML='';$('#confirm-import').disabled=true;$('#import-dialog').showModal();
}

function downloadImportTemplate(){
  if(!window.XLSX)return toast('ไม่สามารถโหลดระบบสร้าง Excel','error');
  const allowedOrgs=canManageAll()?state.data.organizations:state.data.organizations.filter(o=>o.id===state.profile.organization_id);
  const exampleOrg=allowedOrgs[0],exampleType=state.data.equipmentTypes[0];
  const example=Object.fromEntries(importHeaders.map(h=>[h,'']));
  Object.assign(example,{'รหัส อปท.':exampleOrg?.official_code||'','ประเภทอุปกรณ์':exampleType?.name||'','ชื่ออุปกรณ์':'ตัวอย่างอุปกรณ์','สถานะ':'พร้อมใช้งาน','จำนวน':1,'หน่วยนับ':'รายการ','ละติจูด':19.91,'ลองจิจูด':99.84,'อำเภอ':exampleOrg?.district||'เมืองเชียงราย'});
  const wb=XLSX.utils.book_new(),dataWs=XLSX.utils.json_to_sheet([example],{header:importHeaders});
  dataWs['!cols']=importHeaders.map(h=>({wch:Math.max(13,h.length+4)}));
  XLSX.utils.book_append_sheet(wb,dataWs,'ข้อมูลอุปกรณ์');
  const guide=[
    ['คำแนะนำ','รายละเอียด'],['การเพิ่มใหม่','เว้น “รหัสอุปกรณ์” ว่าง ระบบจะออกรหัสให้อัตโนมัติ'],['การแก้ไข','ใส่รหัสอุปกรณ์เดิม เช่น 1803-0001 และห้ามเปลี่ยน อปท. เจ้าของ'],['การบันทึก','หากมีแถวใดผิด ระบบจะไม่บันทึกทั้งไฟล์'],['สถานะที่ใช้ได้',Object.values(statusMeta).map(x=>x.label).join(', ')],['รูปแบบวันที่','YYYY-MM-DD เช่น 2026-09-24']
  ];
  const guideWs=XLSX.utils.aoa_to_sheet(guide);guideWs['!cols']=[{wch:18},{wch:85}];XLSX.utils.book_append_sheet(wb,guideWs,'คำแนะนำ');
  const refRows=[['รหัส อปท.','ชื่อหน่วยงาน','อำเภอ'],...allowedOrgs.map(o=>[o.official_code,o.name,o.district]),[],['ประเภทอุปกรณ์'],...state.data.equipmentTypes.map(t=>[t.name])];
  const refWs=XLSX.utils.aoa_to_sheet(refRows);refWs['!cols']=[{wch:15},{wch:50},{wch:22}];XLSX.utils.book_append_sheet(wb,refWs,'รายการอ้างอิง');
  XLSX.writeFile(wb,`แม่แบบนำเข้าอุปกรณ์-${dateStamp()}.xlsx`);
}

function textValue(value){return String(value??'').trim();}
function orgCodeValue(value){const raw=textValue(value).replace(/\.0$/,'');return raw.padStart(8,'0');}
function numberValue(value){if(value===''||value===null||value===undefined)return NaN;return Number(String(value).replace(/,/g,''));}
function excelDate(value){
  if(value===''||value===null||value===undefined)return null;
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
  if(typeof value==='number'&&window.XLSX){const d=XLSX.SSF.parse_date_code(value);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
  const s=textValue(value);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m){const year=Number(m[3])>2400?Number(m[3])-543:Number(m[3]);return `${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
  return '__INVALID__';
}

function validateImportRows(sourceRows){
  const errors=[],valid=[],seenCodes=new Set();
  sourceRows.forEach((row,index)=>{
    const rowNo=index+2,fail=message=>errors.push(`แถว ${rowNo}: ${message}`),code=textValue(row['รหัสอุปกรณ์']),orgCode=orgCodeValue(row['รหัส อปท.']);
    const org=state.data.organizations.find(o=>o.official_code===orgCode),type=state.data.equipmentTypes.find(t=>t.name===textValue(row['ประเภทอุปกรณ์'])),existing=code?state.data.equipment.find(x=>x.code===code):null;
    const status=importStatus[textValue(row['สถานะ'])],quantity=numberValue(row['จำนวน']||1),latitude=numberValue(row['ละติจูด']),longitude=numberValue(row['ลองจิจูด']);
    const commissioned=excelDate(row['วันที่เริ่มใช้งาน']),inspected=excelDate(row['วันที่ตรวจล่าสุด']);
    if(code&&!/^\d{4}-\d{4}$/.test(code))fail('รูปแบบรหัสอุปกรณ์ไม่ถูกต้อง');
    if(code&&seenCodes.has(code))fail(`รหัสอุปกรณ์ ${code} ซ้ำในไฟล์`);if(code)seenCodes.add(code);
    if(code&&!existing)fail(`ไม่พบรหัสอุปกรณ์ ${code} สำหรับแก้ไข`);
    if(!org)fail(`ไม่พบรหัส อปท. ${orgCode||'(ว่าง)'}`);
    if(org&&!canManageAll()&&org.id!==state.profile.organization_id)fail('ไม่มีสิทธิ์นำเข้าข้อมูลของ อปท. นี้');
    if(existing&&org&&existing.organization_id!==org.id)fail('ไม่อนุญาตให้เปลี่ยนหน่วยงานเจ้าของของอุปกรณ์เดิม');
    if(!type)fail(`ไม่พบประเภทอุปกรณ์ “${textValue(row['ประเภทอุปกรณ์'])||'(ว่าง)'}”`);
    if(!textValue(row['ชื่ออุปกรณ์']))fail('กรุณาระบุชื่ออุปกรณ์');
    if(!status)fail(`สถานะ “${textValue(row['สถานะ'])||'(ว่าง)'}” ไม่ถูกต้อง`);
    if(!Number.isFinite(quantity)||quantity<0)fail('จำนวนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
    if(!Number.isFinite(latitude)||latitude<-90||latitude>90)fail('ละติจูดไม่ถูกต้อง');
    if(!Number.isFinite(longitude)||longitude<-180||longitude>180)fail('ลองจิจูดไม่ถูกต้อง');
    if(!textValue(row['อำเภอ']))fail('กรุณาระบุอำเภอ');
    if(commissioned==='__INVALID__')fail('วันที่เริ่มใช้งานไม่ถูกต้อง');if(inspected==='__INVALID__')fail('วันที่ตรวจล่าสุดไม่ถูกต้อง');
    valid.push({code:code||null,legacy_code:textValue(row['รหัสเดิม'])||null,organization_code:orgCode,equipment_type_name:textValue(row['ประเภทอุปกรณ์']),name:textValue(row['ชื่ออุปกรณ์']),status,quantity,unit:textValue(row['หน่วยนับ'])||'รายการ',latitude,longitude,basin:textValue(row['ลุ่มน้ำ'])||null,district:textValue(row['อำเภอ']),subdistrict:textValue(row['ตำบล'])||null,brand:textValue(row['ยี่ห้อ'])||null,registration_number:textValue(row['ทะเบียนรถ'])||null,commissioned_at:commissioned==='__INVALID__'?null:commissioned,address:textValue(row['สถานที่จัดเก็บ'])||null,contact_name:textValue(row['ผู้ประสานงาน'])||null,contact_phone:textValue(row['เบอร์ติดต่อ'])||null,last_inspected_at:inspected==='__INVALID__'?null:inspected,notes:textValue(row['หมายเหตุ'])||null});
  });
  return {valid,errors};
}

async function handleImportFile(e){
  const file=e.target.files[0];state.importRows=[];$('#confirm-import').disabled=true;if(!file)return;
  try{
    if(!window.XLSX)throw new Error('ไม่สามารถโหลดระบบอ่าน Excel');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}),sheet=wb.Sheets['ข้อมูลอุปกรณ์']||wb.Sheets[wb.SheetNames[0]];
    const source=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true});if(!source.length)throw new Error('ไม่พบข้อมูลในไฟล์');
    if(source.length>1000)throw new Error('นำเข้าได้สูงสุดครั้งละ 1,000 แถว');
    const missing=importHeaders.filter(h=>!Object.prototype.hasOwnProperty.call(source[0],h));if(missing.length)throw new Error(`ขาดคอลัมน์: ${missing.join(', ')}`);
    const result=validateImportRows(source),inserted=result.valid.filter(x=>!x.code).length,updated=result.valid.length-inserted;
    $('#import-summary').textContent=`พบ ${source.length.toLocaleString('th-TH')} แถว · เพิ่มใหม่ ${inserted.toLocaleString('th-TH')} · แก้ไข ${updated.toLocaleString('th-TH')} · ข้อผิดพลาด ${result.errors.length.toLocaleString('th-TH')}`;
    $('#import-errors').classList.toggle('hidden',!result.errors.length);$('#import-errors').innerHTML=result.errors.length?`<b>กรุณาแก้ไขก่อนนำเข้า</b><ul>${result.errors.slice(0,50).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${result.errors.length>50?`<p>และอีก ${result.errors.length-50} รายการ</p>`:''}`:'';
    $('#import-preview').innerHTML=table(['แถว','การทำงาน','รหัส อปท.','ชื่ออุปกรณ์','ประเภท','สถานะ'],result.valid.slice(0,10).map((x,i)=>[i+2,x.code?'แก้ไข':'เพิ่มใหม่',esc(x.organization_code),esc(x.name),esc(x.equipment_type_name),esc(statusMeta[x.status]?.label||x.status)]),'');
    if(!result.errors.length){state.importRows=result.valid;$('#confirm-import').disabled=false;}
  }catch(err){$('#import-summary').textContent=`อ่านไฟล์ไม่สำเร็จ: ${err.message}`;$('#import-errors').classList.add('hidden');$('#import-preview').innerHTML='';}
}

async function confirmImport(e){
  e.preventDefault();if(e.submitter?.value==='cancel'){ $('#import-dialog').close();return; }
  if(!state.importRows.length)return;
  setLoading(true);$('#confirm-import').disabled=true;
  try{const result=await service.importEquipmentBatch(state.importRows);$('#import-dialog').close();toast(`นำเข้าสำเร็จ ${Number(result.total||state.importRows.length).toLocaleString('th-TH')} รายการ`);state.equipmentPage=1;await reloadData();}
  catch(err){toast(`นำเข้าไม่สำเร็จ: ${err.message}`,'error');$('#confirm-import').disabled=false;}
  finally{setLoading(false);}
}

async function exportDashboard(format){
  const target=$('#view-dashboard');
  if(!window.html2canvas)return toast('ไม่สามารถโหลดระบบสร้างภาพรายงาน','error');
  setLoading(true);target.classList.add('exporting');
  try{
    const canvas=await html2canvas(target,{scale:2,useCORS:true,backgroundColor:'#f3f6f8',ignoreElements:el=>el.classList?.contains('export-ignore')});
    if(format==='png'){
      canvas.toBlob(blob=>downloadBlob(blob,`floodops-dashboard-${dateStamp()}.png`),'image/png');
    }else{
      if(!window.jspdf?.jsPDF)throw new Error('ไม่สามารถโหลดระบบสร้าง PDF');
      const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),margin=8,pageW=297,pageH=210,maxW=pageW-margin*2,maxH=pageH-margin*2,ratio=Math.min(maxW/canvas.width,maxH/canvas.height),w=canvas.width*ratio,h=canvas.height*ratio;
      pdf.addImage(canvas.toDataURL('image/jpeg',.92),'JPEG',(pageW-w)/2,margin,w,h,'','FAST');
      pdf.save(`floodops-dashboard-${dateStamp()}.pdf`);
    }
    toast(`ดาวน์โหลดแดชบอร์ด ${format.toUpperCase()} แล้ว`);
  }catch(err){console.error(err);toast(`สร้างไฟล์ไม่สำเร็จ: ${err.message}`,'error');}
  finally{target.classList.remove('exporting');setLoading(false);}
}

function initMap() {
  if(state.map)return;
  state.map=L.map('map',{zoomControl:false}).setView(APP_CONFIG.mapCenter,APP_CONFIG.mapZoom);
  L.control.zoom({position:'bottomright'}).addTo(state.map);
  state.baseLayers={
    street:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}),
    satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'})
  };
  setBaseMap($('#map-basemap').value||'street');
  state.markers=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:44}).addTo(state.map);
  fetch('data/chiangrai-province.json').then(r=>r.json()).then(g=>{state.boundary=L.geoJSON(g,{style:{color:'#0b6bcb',weight:2.5,fillColor:'#0b6bcb',fillOpacity:.035}}).addTo(state.map);state.map.fitBounds(state.boundary.getBounds(),{padding:[15,15]});}).catch(()=>{});
  state.map.on('click',e=>findNearest(e.latlng,'click'));
}

function setBaseMap(name){
  if(!state.map||!state.baseLayers)return;
  const selected=state.baseLayers[name]||state.baseLayers.street;
  if(state.currentBaseLayer&&state.map.hasLayer(state.currentBaseLayer))state.map.removeLayer(state.currentBaseLayer);
  selected.addTo(state.map);selected.bringToBack();state.currentBaseLayer=selected;
}

function filteredMapItems(){const q=$('#map-search').value.trim().toLowerCase(),basin=$('#map-basin-filter').value,type=$('#map-type-filter').value,status=$('#map-status-filter').value;return state.data.equipment.filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))&&(!q||[x.name,x.code,x.district,x.subdistrict,x.brand,x.registration_number,getOrg(x.organization_id)?.name].join(' ').toLowerCase().includes(q))&&(!basin||x.basin===basin)&&(!type||x.equipment_type_id===type)&&(!status||x.status===status));}
function renderMapMarkers(){if(!state.map)return;state.markers.clearLayers();filteredMapItems().forEach(x=>{const m=statusMeta[x.status]||{},icon=L.divIcon({className:'equipment-marker-wrap',html:`<div class="equipment-marker ${m.class}">${esc(getType(x.equipment_type_id)?.icon||'●')}</div>`,iconSize:[40,40],iconAnchor:[20,20]});L.marker([x.latitude,x.longitude],{icon}).bindPopup(`<div class="map-popup"><span>${esc(getType(x.equipment_type_id)?.name||'-')}</span><h3>${esc(x.name)}</h3><p>${esc(getOrg(x.organization_id)?.name||'-')}<br>${esc(x.subdistrict||'-')} · ${esc(x.district||'-')}<br>${esc(x.basin||'-')}</p>${statusBadge(x.status)}<hr><b>ทะเบียน:</b> ${esc(x.registration_number||'-')} · <b>ยี่ห้อ:</b> ${esc(x.brand||'-')}<br><b>ติดต่อ:</b> ${esc(x.contact_phone||'ไม่ระบุ')}</div>`).addTo(state.markers);});}
function distanceKm(a,b){const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lng-a.lng)*Math.PI/180,la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180;return 2*R*Math.asin(Math.sqrt(Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2));}
function findNearest(point,source='click'){state.searchPoint=point;state.searchSource=source;const radius=Number($('#radius-input').value)||15;if(state.searchCircle)state.map.removeLayer(state.searchCircle);if(state.searchMarker)state.map.removeLayer(state.searchMarker);const gps=source==='gps',label=gps?'ตำแหน่งของฉัน':'จุดที่เลือก',symbol=gps?'◎':'📍',color=gps?'#0b6bcb':'#e77922';state.searchCircle=L.circle(point,{radius:radius*1000,color,fillColor:color,fillOpacity:.08,weight:2}).addTo(state.map);const originIcon=L.divIcon({className:'search-origin-wrap',html:`<div class="search-origin ${gps?'gps':'clicked'}"><span>${symbol}</span><b>${label}</b></div>`,iconSize:[126,46],iconAnchor:[20,38]});state.searchMarker=L.marker(point,{icon:originIcon,zIndexOffset:3000,keyboard:false}).addTo(state.map);const list=filteredMapItems().map(x=>({...x,distance:distanceKm(point,{lat:Number(x.latitude),lng:Number(x.longitude)})})).filter(x=>x.distance<=radius).sort((a,b)=>a.distance-b.distance).slice(0,8);$('#nearest-list').innerHTML=list.length?list.map((x,i)=>`<button class="nearest-item" data-nearest="${x.id}"><span>${i+1}</span><div><b>${esc(x.name)}</b><small>${esc(getOrg(x.organization_id)?.short_name||'-')} · ${statusMeta[x.status]?.label}</small></div><strong>${x.distance.toFixed(1)} กม.</strong></button>`).join(''):`<div class="empty">ไม่พบอุปกรณ์ในรัศมี ${radius} กม.</div>`;$('#nearest-panel').classList.add('open');$$('[data-nearest]').forEach(b=>b.addEventListener('click',()=>{const x=state.data.equipment.find(v=>v.id===b.dataset.nearest);state.map.flyTo([x.latitude,x.longitude],15);}));}
function useGps(){if(!navigator.geolocation)return toast('เบราว์เซอร์นี้ไม่รองรับ GPS','error');navigator.geolocation.getCurrentPosition(p=>{const ll=L.latLng(p.coords.latitude,p.coords.longitude);state.map.flyTo(ll,13);findNearest(ll,'gps');},e=>toast(`ไม่สามารถอ่าน GPS: ${e.message}`,'error'),{enableHighAccuracy:true,timeout:10000});}
function clearMapSearch(){$('#map-search').value='';$('#map-basin-filter').value='';$('#map-type-filter').value='';$('#map-status-filter').value='';if(state.searchCircle)state.map.removeLayer(state.searchCircle);if(state.searchMarker)state.map.removeLayer(state.searchMarker);state.searchCircle=null;state.searchMarker=null;state.searchPoint=null;state.searchSource=null;$('#nearest-panel').classList.remove('open');renderMapMarkers();}

function input(name,label,value='',type='text',attrs=''){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;}
function select(name,label,options,value='',attrs=''){return `<label>${label}<select name="${name}" ${attrs}>${options.map(([v,l])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;}
function openDialog(kind,title,fields,record){const d=$('#entity-dialog');d.dataset.kind=kind;d.dataset.id=record?.id||'';$('#dialog-title').textContent=title;$('#dialog-fields').innerHTML=fields;d.showModal();}
function openEquipmentDialog(x={}){const orgs=canManageAll()?state.data.organizations:state.data.organizations.filter(o=>o.id===state.profile.organization_id);const codeField=x.id?input('code','รหัสอุปกรณ์ (ระบบกำหนด)',x.code,'text','readonly'):`<label>รหัสอุปกรณ์<input value="ระบบจะออกเลขให้อัตโนมัติเมื่อบันทึก" disabled></label>`;openDialog('equipment',x.id?'แก้ไขอุปกรณ์':'เพิ่มอุปกรณ์',codeField+input('name','ชื่ออุปกรณ์',x.name,'text','required')+select('equipment_type_id','ประเภทอุปกรณ์',state.data.equipmentTypes.map(t=>[t.id,t.name]),x.equipment_type_id,'required')+select('organization_id','หน่วยงานเจ้าของ',orgs.map(o=>[o.id,`${o.short_code||'----'} · ${o.name}`]),x.organization_id||state.profile.organization_id,'required')+select('status','สถานะ',Object.entries(statusMeta).map(([k,v])=>[k,v.label]),x.status||'ready','required')+input('basin','บริเวณลุ่มแม่น้ำ',x.basin,'text','required')+input('district','อำเภอ',x.district,'text','required')+input('subdistrict','ตำบล',x.subdistrict,'text','required')+input('brand','ยี่ห้อ',x.brand)+input('registration_number','ทะเบียนรถ',x.registration_number)+input('commissioned_at','วันที่ใช้งาน',x.commissioned_at,'date')+input('quantity','จำนวน',x.quantity||1,'number','min="0" required')+input('unit','หน่วยนับ',x.unit||'รายการ','text','required')+input('latitude','ละติจูด',x.latitude,'number','step="any" required')+input('longitude','ลองจิจูด',x.longitude,'number','step="any" required')+input('address','สถานที่จัดเก็บ',x.address)+input('contact_name','ผู้ประสานงาน',x.contact_name)+input('contact_phone','เบอร์โทรศัพท์',x.contact_phone,'tel')+input('last_inspected_at','วันที่ตรวจสอบล่าสุด',x.last_inspected_at,'date')+`<label class="span-2">หมายเหตุ<textarea name="notes" rows="3">${esc(x.notes||'')}</textarea></label>`+(x.id?'<button type="button" id="delete-current" class="btn danger">ลบรายการนี้</button>':''),x);if(x.id)$('#delete-current').addEventListener('click',()=>deleteEquipment(x));}
function openOrganizationDialog(x={}){openDialog('organization',x.id?'แก้ไขหน่วยงาน':'เพิ่มหน่วยงาน',input('official_code','รหัส อปท. 8 หลัก',x.official_code,'text','pattern="\\d{8}" maxlength="8" required')+input('short_code','รหัสย่อ 4 หลัก',x.short_code,'text','pattern="\\d{4}" maxlength="4" required')+input('name','ชื่อเต็มของหน่วยงาน',x.name,'text','required')+input('short_name','ชื่อย่อ',x.short_name,'text','required')+input('district','อำเภอ',x.district,'text','required')+input('phone','เบอร์โทรศัพท์',x.phone,'tel'),x);}
function openUserDialog(x){openDialog('profile','กำหนดสิทธิ์ผู้ใช้งาน',input('full_name','ชื่อ–นามสกุล',x.full_name,'text','required')+select('organization_id','สังกัดหน่วยงาน',state.data.organizations.map(o=>[o.id,o.name]),x.organization_id,'required')+select('role','บทบาท',Object.entries(roleLabel).map(([k,v])=>[k,v]),x.role,'required')+select('active','สถานะบัญชี',[['true','ใช้งาน'],['false','ระงับการใช้งาน']],String(x.active!==false),'required'),x);}
async function handleDialogSubmit(e){e.preventDefault();const d=$('#entity-dialog');if(e.submitter?.value==='cancel'){d.close();return;}const data=Object.fromEntries(new FormData(e.target));if(d.dataset.id)data.id=d.dataset.id;setLoading(true);try{if(d.dataset.kind==='equipment'){data.quantity=Number(data.quantity);data.latitude=Number(data.latitude);data.longitude=Number(data.longitude);await service.saveEquipment(data);}else if(d.dataset.kind==='organization')await service.saveOrganization(data);else{data.active=data.active==='true';await service.saveProfile(data);}d.close();toast('บันทึกข้อมูลเรียบร้อย');await reloadData();}catch(err){toast(err.message,'error');}finally{setLoading(false);}}
async function deleteEquipment(x){if(!confirm(`ยืนยันการลบ “${x.name}” หรือไม่`))return;setLoading(true);try{await service.deleteEquipment(x.id);$('#entity-dialog').close();toast('ลบข้อมูลเรียบร้อย');await reloadData();}catch(err){toast(err.message,'error');}finally{setLoading(false);}}

boot();
