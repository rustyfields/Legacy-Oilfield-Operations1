/* CrudeForce Tank Gauges module v1.16.16 */
function tankLeaseKey(t={}){return `${t.lease_name||''}|||${t.lease_number||''}`}
function tankLeaseLabelFromKey(key=''){const [name,num]=key.split('|||');return `${name||''}${num?' #'+num:''}`}
function tankGaugeStatusForLease(tanks=[]){
 let latest=null,total=0,known=0,nearlyFull=false;
 for(const t of tanks){const g=(tankGaugeHistoryCache[t.id]||[])[0];if(g){if(!latest||new Date(g.gauged_at)>new Date(latest))latest=g.gauged_at;total+=Number(g.calculated_bbl||0);known++;if(t.capacity_bbl!=null&&Number(t.capacity_bbl)>0&&Number(g.calculated_bbl)/Number(t.capacity_bbl)>=.9)nearlyFull=true}}
 return {latest,total,known,nearlyFull}
}
function tankTransportStatusForLease(tanks=[]){
 const ids=new Set(tanks.map(t=>t.id)),numbers=new Set(tanks.map(t=>String(t.tank_number)));
 const open=(tankOilSalesCache||[]).filter(x=>((x.tank_id&&ids.has(x.tank_id))||(!x.tank_id&&numbers.has(String(x.tank_number))))&&x.status!=='picked_up');
 const turnedDownIds=new Set((tankAdjustmentCache||[]).filter(x=>x.alert_active&&ids.has(x.tank_id)).map(x=>x.tank_id)),waiting=[],turned=[];
 for(const sale of open){const t=tanks.find(x=>x.id===sale.tank_id)||tanks.find(x=>String(x.tank_number)===String(sale.tank_number));if(!t)continue;(turnedDownIds.has(t.id)?turned:waiting).push(String(t.tank_number))}
 return {waiting:[...new Set(waiting)].sort(naturalCompare),turned:[...new Set(turned)].sort(naturalCompare)}
}
function renderTankLease(key){
 activeTankLeaseKey=key;
 const tanks=refs.tanks.filter(t=>t.active && tankLeaseKey(t)===key).sort((a,b)=>naturalCompare(a.tank_number,b.tank_number));
 const cards=tanks.map(t=>{
   const hist=tankGaugeHistoryCache[t.id]||[], current=hist[0], previous=hist[1];
   const currentBbl=current?Number(current.calculated_bbl):null;
   const room=t.capacity_bbl==null||currentBbl==null?null:Number(t.capacity_bbl)-currentBbl;
   let hauled=null, est=null, invChange=null;
   if(current&&previous){
     hauled=tankOilSalesCache.filter(s=>{
       const linked=s.tank_id===t.id || (!s.tank_id && String(s.tank_number)===String(t.tank_number));
       return linked && s.picked_up_at && new Date(s.picked_up_at)>new Date(previous.gauged_at) && new Date(s.picked_up_at)<=new Date(current.gauged_at) && s.gross_bbl_hauled!=null;
     }).reduce((n,s)=>n+Number(s.gross_bbl_hauled||0),0);
     invChange=currentBbl-Number(previous.calculated_bbl);
     est=invChange+hauled;
   }
   const recentHauls=tankOilSalesCache.filter(s=>s.tank_id===t.id || (!s.tank_id&&String(s.tank_number)===String(t.tank_number))).slice(0,3);
   const haulText=recentHauls.length?recentHauls.map(s=>`${s.called_in_at?'Called '+new Date(s.called_in_at).toLocaleString():'Call-in time missing'}${s.confirmation_number?' • Conf '+esc(s.confirmation_number):''}<br>${s.picked_up_at?'Picked up '+new Date(s.picked_up_at).toLocaleString():'Awaiting pickup'}${s.gross_bbl_hauled==null?'':' • '+Number(s.gross_bbl_hauled).toFixed(2)+' bbl'}${s.gauge_variance_inches==null?'':`<br>Purchaser gauge variance ${Number(s.gauge_variance_inches)>=0?'+':''}${Number(s.gauge_variance_inches).toFixed(3)} in • ${Number(s.gauge_variance_bbl)>=0?'+':''}${Number(s.gauge_variance_bbl).toFixed(2)} bbl${s.gauge_variance_flag?' • '+badge('Exception'):''}`}<br>${oilSaleDeleteAction(s)}`).join('<br><br>'):'No call-in or haul history yet.';
   const adj=tankAdjustmentCache.filter(a=>a.tank_id===t.id).slice(0,3);
   const adjText=adj.length?adj.map(a=>`${new Date(a.adjustment_at).toLocaleString()} • ${esc(a.material_name_snapshot)} • ${esc(a.status.replaceAll('_',' '))}<br>Calculated removed ${Number(a.calculated_material_removed_bbl||0).toFixed(2)} bbl${a.hauler_reported_bbl==null?'':` • Hauler ${Number(a.hauler_reported_bbl).toFixed(2)} bbl • Variance ${Number(a.hauler_variance_bbl)>=0?'+':''}${Number(a.hauler_variance_bbl).toFixed(2)} bbl`}`).join('<br><br>'):'No turn-down/removal events yet.';
   return `<div class="panel">
     <div class="toolbar"><div><h2 style="margin:0">Tank ${esc(t.tank_number)}</h2><div class="small muted">${t.capacity_bbl==null?'Capacity not entered':Number(t.capacity_bbl).toFixed(2)+' bbl capacity'} • Multiplier ${Number(t.multiplier).toFixed(4)} bbl/in</div></div>
       <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary newGaugeForTank" data-id="${t.id}">Enter Current Gauge</button><button class="btn callInTank" data-id="${t.id}">Call In Tank</button>${(()=>{const os=(tankOilSalesCache||[]).filter(s=>(s.tank_id===t.id||(!s.tank_id&&String(s.tank_number)===String(t.tank_number)))&&s.status!=='picked_up').sort((a,b)=>new Date(b.called_in_at||0)-new Date(a.called_in_at||0))[0];return os?`<button class="btn editCallInTank" data-id="${t.id}">Edit Call-In</button>`:'' })()}${(()=>{
 const openSale=(tankOilSalesCache||[]).filter(s=>(s.tank_id===t.id||(!s.tank_id&&String(s.tank_number)===String(t.tank_number)))&&s.status!=='picked_up').sort((a,b)=>new Date(b.called_in_at||0)-new Date(a.called_in_at||0))[0];
 const td=openSale?(tankAdjustmentCache||[]).find(a=>a.oil_sale_id===openSale.id && a.alert_active):null;
 return `<button class="btn tankAdjustment" data-id="${t.id}"${td?' style="border-color:#dc3545;font-weight:800"':''}>${td?'⚠ Update Turn-Down':'Tank Turn-Down / Removal'}</button>`;
})()}<button class="btn addTankHaul" data-id="${t.id}">Add Oil Haul / Run Ticket</button></div>
     </div>
     <div class="two">
       <div><b>Previous Reading</b><div class="muted">${previous?`${previous.gauge_feet}' ${Number(previous.gauge_inches).toFixed(3)}" • ${Number(previous.calculated_bbl).toFixed(2)} bbl<br>${new Date(previous.gauged_at).toLocaleString()}`:(current?'No earlier reading':'No gauge history')}</div></div>
       <div><b>Current Reading</b><div>${current?`${current.gauge_feet}' ${Number(current.gauge_inches).toFixed(3)}" • <b>${currentBbl.toFixed(2)} bbl</b><br><span class="muted">${new Date(current.gauged_at).toLocaleString()}</span>`:'Not entered yet'}</div></div>
     </div>
     <div class="two" style="margin-top:10px">
       <div><b>Available Room</b><div>${room==null?'—':room.toFixed(2)+' bbl'}</div></div>
       <div><b>Last Gauge Period</b><div>${est==null?'Need two gauges for period calculation':`Inventory ${invChange>=0?'+':''}${invChange.toFixed(2)} bbl • Hauled ${hauled.toFixed(2)} bbl • <b>Est. Produced ${est.toFixed(2)} bbl</b>`}</div></div>
     </div>
     <div style="margin-top:10px"><b>Call-In / Oil Haul History</b><div class="small muted">${haulText}</div></div><div style="margin-top:10px"><b>Turn-Down / Material Removal History</b><div class="small muted">${adjText}</div></div>
   </div>`
 }).join('');
 const history=(Object.values(tankGaugeHistoryCache).flat()).filter(g=>tanks.some(t=>t.id===g.tank_id)).sort((a,b)=>new Date(b.gauged_at)-new Date(a.gauged_at));
 const rows=history.map(g=>{const t=refs.tanks.find(x=>x.id===g.tank_id)||{};return `<tr><td><button class="btn editGauge" data-id="${g.id}">Open / Edit</button></td><td>${esc(t.tank_number||'')}</td><td>${g.gauge_feet}' ${Number(g.gauge_inches).toFixed(3)}"</td><td>${Number(g.calculated_bbl).toFixed(2)}</td><td>${new Date(g.gauged_at).toLocaleString()}</td><td>${esc(g.notes||'')}</td></tr>`});
 $('#content').innerHTML=`<div class="panel"><div class="toolbar"><button class="btn" id="backToTankLeases">✓ Done / All Leases & Batteries</button><div><h2 style="margin:0">${esc(tankLeaseLabelFromKey(key))}</h2><div class="small muted">${tanks.length} active tank${tanks.length===1?'':'s'}</div></div></div></div>${cards||'<div class="panel"><div class="empty">No active tanks configured for this lease.</div></div>'}<div class="panel"><h2>Gauge History - ${esc(tankLeaseLabelFromKey(key))}</h2>${rows.length?table(['Action','Tank','Gauge','Calculated BBLS','Date / Time','Notes'],rows):'<div class="empty">No gauge history yet.</div>'}</div>`;
 $('#backToTankLeases').onclick=()=>{activeTankLeaseKey=null;renderTankGaugeLanding()};
 document.querySelectorAll('.editGauge').forEach(b=>b.onclick=()=>editTankGauge(b.dataset.id));
 document.querySelectorAll('.newGaugeForTank').forEach(b=>b.onclick=()=>{const id=b.dataset.id;openModal('Enter current tank gauge',tankGaugeForm({tank_id:id}),async f=>{const o=tankGaugePayload(f);o.created_by=me.id;const r=await saveWithOffline('tank_gauges','insert',o);if(r.queued)toast('Saved on this device • waiting for signal to sync');await listTankGauges();renderTankLease(key)});setTimeout(updateGaugePreview,0)});
 document.querySelectorAll('.callInTank').forEach(b=>b.onclick=()=>openTankCallIn(b.dataset.id));document.querySelectorAll('.editCallInTank').forEach(b=>b.onclick=()=>editTankCallIn(b.dataset.id));
 document.querySelectorAll('.tankAdjustment').forEach(b=>b.onclick=()=>openTankAdjustment(b.dataset.id));
 document.querySelectorAll('.addTankHaul').forEach(b=>b.onclick=()=>openTankPickup(b.dataset.id));
 bindOilDeleteActions();
}
function renderTankGaugeLanding(){
 const active=refs.tanks.filter(t=>t.active);
 const groups={};for(const t of active){(groups[tankLeaseKey(t)]??=[]).push(t)}
 const groupCards=Object.entries(groups).sort((a,b)=>naturalCompare(tankLeaseLabelFromKey(a[0]),tankLeaseLabelFromKey(b[0]))).map(([key,tanks])=>{
   const s=tankGaugeStatusForLease(tanks);
   const transport=tankTransportStatusForLease(tanks);
   const completion=`${s.known}/${tanks.length} tanks with a reading`;
   const alert=s.nearlyFull?`<div style="margin-top:6px">${badge('Near Full')}</div>`:'';
   const transportLine=transport.waiting.length?`<div class="statusline">${statusChip(`Awaiting Transport • ${transport.waiting.length}`)}<span class="small muted">Tank${transport.waiting.length===1?'':'s'} ${transport.waiting.map(esc).join(', ')}</span></div>`:'';
   const turnDownLine=transport.turned.length?`<div class="statusline">${statusChip(`Turn-Down Pending • ${transport.turned.length}`)}<span class="small muted">Tank${transport.turned.length===1?'':'s'} ${transport.turned.map(esc).join(', ')}</span></div>`:'';
   return `<div class="panel">
     <div class="toolbar"><div><h2 style="margin:0">${esc(tankLeaseLabelFromKey(key))}</h2><div class="small muted">${tanks.length} tank${tanks.length===1?'':'s'} • ${completion}</div></div><button class="btn primary openTankLease" data-key="${encodeURIComponent(key)}">Open Lease / Battery</button></div>
     <div class="two">
       <div><b>Last Report</b><div>${s.latest?new Date(s.latest).toLocaleString():'Not reported'}</div></div>
       <div><b>Current Oil Inventory</b><div>${s.known?`${s.total.toFixed(2)} bbl`:'—'}</div></div>
     </div>${transportLine}${turnDownLine}${alert}
   </div>`
 }).join('');
 $('#content').innerHTML=`${adminDeleteRequestPanel()}${unresolvedTurnDownPanel()}<div class="panel"><div class="notice"><b>Tank Gauging / Oil Inventory:</b> Leases and batteries are grouped here. Open a lease to enter gauges, call tanks in, document turn-down/material-removal events, and record oil hauls/run tickets. The previous saved gauge carries forward automatically.</div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">${groupCards||'<div class="panel"><div class="empty">No active tanks configured yet.</div></div>'}</div>${tankAdminPanel()}${materialTypeAdminPanel()}`;
 document.querySelectorAll('.openTankLease').forEach(b=>b.onclick=()=>renderTankLease(decodeURIComponent(b.dataset.key)));
 document.querySelectorAll('.resolveTurnDown').forEach(b=>b.onclick=()=>openTankAdjustment(b.dataset.tank));
 bindTankAdmin();
 bindRemovalTypeAdmin();
 bindOilDeleteActions();
}
async function listTankGauges(){
 // Paint the tank landing immediately from already-loaded reference data so the UI never stalls on Loading while optional history/audit queries run.
 renderTankGaugeLanding();
 await loadOilSaleDeleteRequests();
 const [{data=[],error},{data:oilSales=[],error:oilError},{data:adjustments=[],error:adjustmentError}]=await Promise.all([
   sb.from('tank_gauges').select('*').order('gauged_at',{ascending:false}),
   sb.from('oil_sales_pickups').select('*').is('deleted_at',null).order('called_in_at',{ascending:false}),
   sb.from('tank_adjustments').select('*').order('adjustment_at',{ascending:false})
 ]);
 if(error){toast('Tank gauge history unavailable: '+error.message);return}
 if(oilError)console.error('Oil sales history unavailable',oilError);
 if(adjustmentError)console.error('Tank adjustment history unavailable',adjustmentError);
 tankOilSalesCache=oilError?[]:(oilSales||[]);
 tankAdjustmentCache=adjustmentError?[]:(adjustments||[]);
 tankGaugeHistoryCache={};
 for(const g of data){(tankGaugeHistoryCache[g.tank_id]??=[]).push(g)}
 if(activeTankLeaseKey)renderTankLease(activeTankLeaseKey);else renderTankGaugeLanding();
 await refreshTurnDownAlerts();
}

