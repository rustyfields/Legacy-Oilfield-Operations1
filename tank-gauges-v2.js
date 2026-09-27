/* CrudeForce Tank Gauges v2 - self-contained rebuild */
(()=>{
'use strict';
const api=window.CrudeForceTankAPI||{}, sb=api.sb;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const key=t=>String(t.lease_name||'')+'|||'+String(t.lease_number||'');
const label=k=>{const [n,num]=k.split('|||');return n+(num?' #'+num:'')};
const fmt=d=>d?new Date(d).toLocaleString():'No gauge recorded';
let state={tanks:[],gauges:[],sales:[],adjustments:[]};
function content(){return $('#content')}
function notice(msg){content().innerHTML='<div class="panel"><div class="notice">'+esc(msg)+'</div></div>'}
async function load(){
 if(!sb)throw new Error('Tank data connection unavailable');
 const [t,g,s,a]=await Promise.all([
  sb.from('tanks').select('*').eq('active',true).order('lease_name').order('display_order').order('tank_number'),
  sb.from('tank_gauges').select('*').order('gauged_at',{ascending:false}).limit(1000),
  sb.from('oil_sales_pickups').select('*').is('deleted_at',null).order('called_in_at',{ascending:false}).limit(500),
  sb.from('tank_adjustments').select('*').eq('alert_active',true).order('adjustment_at',{ascending:false}).limit(500)
 ]);
 for(const r of [t,g,s,a])if(r.error)throw r.error;
 state={tanks:t.data||[],gauges:g.data||[],sales:s.data||[],adjustments:a.data||[]};
}
function latestGauge(tid){return state.gauges.find(g=>g.tank_id===tid)}
function leaseSummary(tanks){
 let total=0,known=0,latest=null,waiting=0,turned=0;
 const ids=new Set(tanks.map(t=>t.id));
 for(const t of tanks){const g=latestGauge(t.id);if(g){known++;total+=Number(g.calculated_bbl||0);if(!latest||new Date(g.gauged_at)>new Date(latest))latest=g.gauged_at}}
 for(const x of state.sales){if(x.tank_id&&ids.has(x.tank_id)&&x.status!=='picked_up')waiting++}
 for(const x of state.adjustments){if(ids.has(x.tank_id))turned++}
 return {total,known,latest,waiting,turned};
}
function renderLanding(){
 const groups=new Map();for(const t of state.tanks){const k=key(t);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(t)}
 const cards=[...groups.entries()].map(([k,ts])=>{const x=leaseSummary(ts);return '<button class="panel" data-tank-lease="'+encodeURIComponent(k)+'" style="width:100%;text-align:left;margin-bottom:12px"><h3 style="margin:0 0 8px">'+esc(label(k))+'</h3><div class="muted">'+ts.length+' tank'+(ts.length===1?'':'s')+' • '+x.known+' gauged • '+x.total.toFixed(2)+' bbl</div><div class="muted" style="margin-top:4px">'+esc(fmt(x.latest))+(x.waiting?' • '+x.waiting+' awaiting pickup':'')+(x.turned?' • '+x.turned+' turn-down alert':'')+'</div></button>'}).join('');
 content().innerHTML='<div class="panel"><div class="toolbar" style="justify-content:space-between"><div><h2 style="margin:0">Tank Gauges</h2><div class="muted">Clean rebuild • live tank data</div></div><button class="btn" id="tankRefresh">Refresh</button></div></div><div style="height:12px"></div>'+(cards||'<div class="panel">No active tanks found.</div>');
 $('#tankRefresh').onclick=()=>window.listTankGauges();
 document.querySelectorAll('[data-tank-lease]').forEach(b=>b.onclick=()=>renderLease(decodeURIComponent(b.dataset.tankLease)));
}
function renderLease(k){
 const ts=state.tanks.filter(t=>key(t)===k);
 const rows=ts.map(t=>{const g=latestGauge(t.id);const sales=state.sales.filter(x=>x.tank_id===t.id&&x.status!=='picked_up').length;const alerts=state.adjustments.filter(x=>x.tank_id===t.id).length;return '<div class="panel" style="margin-bottom:10px"><h3 style="margin:0 0 8px">Tank '+esc(t.tank_number)+'</h3><div><strong>'+(g?Number(g.calculated_bbl||0).toFixed(2):'—')+' bbl</strong></div><div class="muted">'+esc(fmt(g?.gauged_at))+' • Multiplier '+esc(t.multiplier??'—')+(t.capacity_bbl?' • Capacity '+esc(t.capacity_bbl)+' bbl':'')+'</div>'+(sales?'<div class="notice" style="margin-top:8px">'+sales+' pickup awaiting completion</div>':'')+(alerts?'<div class="notice" style="margin-top:8px">'+alerts+' active turn-down alert</div>':'')+'</div>'}).join('');
 content().innerHTML='<div class="panel"><div class="toolbar"><button class="btn" id="tankBack">← Leases</button><h2 style="margin:0">'+esc(label(k))+'</h2></div></div><div style="height:12px"></div>'+rows;
 $('#tankBack').onclick=renderLanding;
}
window.renderTankGaugeLanding=renderLanding;
window.listTankGauges=async function(){
 content().innerHTML='<div class="panel">Loading tank data…</div>';
 try{await load();renderLanding()}catch(e){console.error('Tank v2 load failed',e);notice('Tank load failed: '+(e.message||String(e)))}
};
})();
