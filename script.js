const COM_ASEG={
  'BCI Seguros':    {i:15,is:15},
  'Continental':    {i:10,is:10},
  'HDI Seguros':    {i:18,is:15},
  'Mapfre':         {i:15,is:15},
  'Renta Nacional': {i:12,is:12},
  'Sura':           {i:15,is:15},
  'Unnio':          {i:12,is:12},
  'Sin aseguradora':{i:14,is:14},
};
const TASAS={
  'BCI Seguros':    {i:0.050,isMin:0.160,isMax:0.160},
  'HDI Seguros':    {i:0.055,isMin:0.110,isMax:0.150},
  'Mapfre':         {i:0.060,isMin:0.150,isMax:0.150},
  'Sura':           {i:0.060,isMin:0.240,isMax:0.240},
  'Renta Nacional': {i:0.065,isMin:0.165,isMax:0.165},
  'Unnio':          {i:0.060,isMin:0.130,isMax:0.200},
  'Continental':    {i:0.060,isMin:0.140,isMax:0.170},
};
const SAAS_MES=1.20,ACCESO_INST=25,ACCESO_MESES=6,ACCESO_MES=ACCESO_INST/ACCESO_MESES; // CF paga instalación 25 UF en 6 cuotas ≈ 4,17 UF/mes
const TRAMOS=[{u:50,s:.7952},{u:100,s:1.5904},{u:150,s:2.3857},{u:200,s:2.8628},{u:250,s:3.1491},{u:300,s:3.464},{u:350,s:3.8104},{u:400,s:4.1914},{u:450,s:4.6105},{u:500,s:5.0716},{u:550,s:5.5788},{u:600,s:6.1366},{u:650,s:6.7503},{u:700,s:7.4253},{u:750,s:8.1679},{u:800,s:8.9846},{u:850,s:9.8831},{u:900,s:10.8714},{u:950,s:11.9586},{u:1000,s:13.1544}];
function getTramo(u){u=Math.min(u,TRAMOS[TRAMOS.length-1].u);let t=TRAMOS[0];for(let i=0;i<TRAMOS.length;i++){if(u>=TRAMOS[i].u)t=TRAMOS[i];}return t;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

let cob='is',projPeriod=12,projChart=null,mrr=0,costoCitoMes=0,costoCito3m=0;
let tiene={saas:false,cito:false,acceso:false};
let sel={saas:false,cito:false,acceso:false};
let showComparador=false,showHistorial=false,umbralDiferencial=2.0;
let tasaIS=0.0017,tasaI=0.0005;

function getComisionAgente(mrrVal){return (mrrVal/10)*4.5;}
// Normaliza headers para detección insensible a mayúsculas/tildes/símbolos
function norm(s){return String(s).toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/[^a-z0-9]/g,'');}

// ── Vista ──
function setView(v){
  // 'agente' reutiliza view-simulador con clase .mode-agente
  const viewIds=['simulador','bbdd','tabla','dashboard','guia'];
  viewIds.forEach(id=>{
    document.getElementById('view-'+id).style.display=(v===id||(v==='agente'&&id==='simulador'))?'block':'none';
  });
  ['agente','simulador','bbdd','tabla','dashboard','guia'].forEach(id=>{
    document.getElementById('tab-'+id).className='nav-tab'+(v===id?' active':'');
  });
  const simEl=document.getElementById('view-simulador');
  if(v==='agente') simEl.classList.add('mode-agente');
  else simEl.classList.remove('mode-agente');
  if(v==='dashboard')renderDashboard();
  if(v==='tabla')renderTabla();
  if(v==='agente')renderAgenteBBDD();
}

function renderAgenteBBDD(){
  if(!bbddComunidades||bbddComunidades.length===0){
    document.getElementById('agente-bbdd-count').textContent='Sin datos — ve a Análisis de BBDD y carga el archivo primero.';
    document.getElementById('agente-bbdd-export-btn').style.display='none';
    document.getElementById('agente-bbdd-tbody').innerHTML='';
    return;
  }
  const com=parseFloat(document.getElementById('bbdd-comision').value)/100;
  const rows=bbddComunidades.map(r=>{
    const cobr=r.cob||bbddCob;
    const tasa=cobr==='is'?bbddTasaIS:bbddTasaI;
    const mrrSeg=r.ma>0?r.ma*tasa*com/12:0;
    const saasCost=r.tieneSaas?r.precioLista:bbddDefaultIntercompany;
    const diferencial=saasCost>0?mrrSeg/saasCost:0;
    const remanente=mrrSeg-saasCost;
    return{...r,cobr,mrrSeg,saasCost,diferencial,remanente};
  }).filter(r=>r.diferencial>=3);
  document.getElementById('agente-bbdd-count').textContent=rows.length.toLocaleString('es-CL')+' comunidades con diferencial ≥ 3x';
  document.getElementById('agente-bbdd-export-btn').style.display=rows.length?'inline-flex':'none';
  window._agenteBBDDRows=rows;
  let html='';
  rows.forEach(r=>{
    const difColor=r.diferencial>=3?'#0a9e72':r.diferencial>=1?'#BA7517':'#d63228';
    html+=`<tr>
      <td>${esc(r.nombre||'')}</td>
      <td style="font-size:11px;color:var(--muted);">${esc(r.rut||'—')}</td>
      <td><span class="estado-badge estado-${r.estadoSeguro||'nunca'}">${r.estadoSeguro||'nunca'}</span></td>
      <td><span class="cn-badge ${r.cobr==='is'?'cn-badge-is':'cn-badge-i'}">${r.cobr==='is'?'Inc.+Sismo':'Incendio'}</span></td>
      <td style="text-align:right;">${r.ma>0?r.ma.toLocaleString('es-CL')+' UF':'—'}</td>
      <td style="text-align:right;color:#1a5ac4;font-weight:500;">${r.mrrSeg>0?fmtUF(r.mrrSeg)+' UF':'—'}</td>
      <td style="text-align:center;"><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;background:${r.tieneSaas?'#0a9e7218':'#d6322818'};color:${r.tieneSaas?'#0a9e72':'#d63228'};">${r.tieneSaas?'Sí':'No'}</span></td>
      <td style="text-align:right;color:${difColor};font-weight:600;">${r.diferencial.toFixed(2)}x</td>
      <td style="text-align:right;font-weight:500;color:${r.remanente>=0?'#0a9e72':'#d63228'};">${(r.remanente>=0?'+':'')+fmtUF(r.remanente)} UF</td>
    </tr>`;
  });
  document.getElementById('agente-bbdd-tbody').innerHTML=html;
}

function exportAgenteBBDD(){
  const rows=window._agenteBBDDRows||[];
  if(!rows.length)return;
  const wsData=[['Comunidad','RUT','Estado seguro','Cobertura','MA (UF)','MRR seguro (UF)','¿Tiene SaaS?','Ratio MRR/SaaS','Remanente corredora (UF)']];
  rows.forEach(r=>{
    wsData.push([r.nombre||'',r.rut||'',r.estadoSeguro||'',r.cobr==='is'?'Inc.+Sismo':'Incendio',r.ma||0,+r.mrrSeg.toFixed(2),r.tieneSaas?'Sí':'No',+r.diferencial.toFixed(4),+r.remanente.toFixed(2)]);
  });
  const ws=XLSX.utils.aoa_to_sheet(wsData);
  const wb_exp=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb_exp,'Agente 3x',ws);
  XLSX.writeFile(wb_exp,'bbdd_agente_3x.xlsx');
}

// ── Parámetros seguro ──
function setCob(c){
  cob=c;
  document.getElementById('btn-is').className='cob-btn'+(c==='is'?' active-is':'');
  document.getElementById('btn-i').className='cob-btn'+(c==='i'?' active-i':'');
  const val=document.getElementById('aseguradora').value;
  if(val&&COM_ASEG[val]){const pct=COM_ASEG[val][c];document.getElementById('comision').value=pct;document.getElementById('comision-v').textContent=pct.toFixed(1)+'%';const sug=document.getElementById('com-sug');sug.style.display='inline-block';sug.textContent='Sugerida para '+val+' ('+(c==='is'?'Inc.+Sismo':'Incendio')+'): '+pct+'%';}
  recalc();
}
function applyTasas(aseg){
  const t=TASAS[aseg];
  const hintIS=document.getElementById('range-is'),hintI=document.getElementById('range-i');
  if(!t){if(hintIS)hintIS.style.display='none';if(hintI)hintI.style.display='none';return;}
  document.getElementById('tasa-is').value=t.isMin;
  document.getElementById('tasa-i').value=t.i;
  const fmt=v=>parseFloat(v.toFixed(3))+'%';
  if(hintIS){
    if(t.isMin!==t.isMax){hintIS.textContent=fmt(t.isMin)+' – '+fmt(t.isMax);hintIS.style.display='block';}
    else hintIS.style.display='none';
  }
  if(hintI){hintI.textContent=fmt(t.i);hintI.style.display='block';}
}
function onAseguradoraChange(){
  const val=document.getElementById('aseguradora').value,sug=document.getElementById('com-sug');
  if(val&&COM_ASEG[val]){const pct=COM_ASEG[val][cob];document.getElementById('comision').value=pct;document.getElementById('comision-v').textContent=pct.toFixed(1)+'%';sug.style.display='inline-block';sug.textContent='Sugerida para '+val+' ('+(cob==='is'?'Inc.+Sismo':'Incendio')+'): '+pct+'%';}
  else sug.style.display='none';
  applyTasas(val);
  updateTasa();
}
function syncMaFromSlider(){document.getElementById('ma-text').value=document.getElementById('ma').value;recalc();}
function syncMaFromText(){let v=parseInt(document.getElementById('ma-text').value)||1000;v=Math.max(1000,Math.min(999999,v));document.getElementById('ma').value=Math.min(v,400000);recalc();}
function syncUnitsFromSlider(){document.getElementById('units-text').value=document.getElementById('units').value;recalc();}
function syncUnitsFromText(){let v=parseInt(document.getElementById('units-text').value)||1;v=Math.max(1,Math.min(9999,v));document.getElementById('units').value=Math.min(v,1000);recalc();}
function toggleProducto(p){tiene[p]=!tiene[p];document.getElementById('tog-'+p).className=tiene[p]?'prod-toggle on-'+p:'prod-toggle';const msgs=[];if(tiene.saas)msgs.push('SaaS excluido de beneficios.');if(tiene.cito)msgs.push('Citofonía excluida de beneficios.');if(tiene.acceso)msgs.push('Control de acceso excluido de beneficios.');const note=document.getElementById('prod-note');note.textContent=msgs.join(' ');note.className=msgs.length?'productos-note visible':'productos-note';recalc();}
function toggle(b){if(document.getElementById('card-'+b).classList.contains('locked'))return;sel[b]=!sel[b];renderCards();renderResumen();updatePitch();updateApoyo();renderComparadorBeneficios();}
function toggleFree(el){el.querySelector('.free-check').classList.toggle('checked');updatePitch();}
function stepTasa(id,dir){
  const input=document.getElementById(id);
  const val=parseFloat(input.value)||0;
  input.value=Math.max(0.01,Math.min(1,parseFloat((val+dir*0.01).toFixed(4))));
  updateTasa();
}
function updateTasa(){
  tasaIS=(parseFloat(document.getElementById('tasa-is').value)||0.17)/100;
  tasaI=(parseFloat(document.getElementById('tasa-i').value)||0.05)/100;
  recalc();
}

// ── Feature 1: Comparador de aseguradoras ──
function toggleComparador(){
  showComparador=!showComparador;
  document.getElementById('comparador-wrap').style.display=showComparador?'block':'none';
  document.getElementById('btn-comparador').textContent=showComparador?'Ocultar comparativa':'Comparar aseguradoras';
  if(showComparador)renderComparador();
}
function renderComparador(){
  if(!showComparador)return;
  const ma=parseFloat(document.getElementById('ma-text').value)||100000;
  const current=document.getElementById('aseguradora').value;
  const fmtT=v=>parseFloat(v.toFixed(3))+'%';
  const rows=Object.entries(COM_ASEG).map(([nombre,comObj])=>{
    const t=TASAS[nombre];
    let tasa,tasaLabel;
    if(t){
      tasa=cob==='is'?t.isMin/100:t.i/100;
      tasaLabel=cob==='is'?(t.isMin===t.isMax?fmtT(t.isMin):fmtT(t.isMin)+' mín'):fmtT(t.i);
    } else {
      tasa=cob==='is'?tasaIS:tasaI;
      tasaLabel=fmtT((cob==='is'?tasaIS:tasaI)*100);
    }
    const prima=ma*tasa,pct=comObj[cob]/100,mrrA=prima*pct/12,comAg=getComisionAgente(mrrA);
    return{nombre,tasaLabel,pct:comObj[cob],mrr:mrrA,comAg};
  }).sort((a,b)=>b.mrr-a.mrr);
  document.getElementById('comp-tbody').innerHTML=rows.map(r=>`<tr class="${r.nombre===current?'comp-current':''}"><td>${r.nombre}${r.nombre===current?' <span class="comp-badge">actual</span>':''}</td><td style="font-size:11px;color:var(--muted);">${r.tasaLabel}</td><td>${r.pct}%</td><td style="color:#1a5ac4;font-weight:500;">${r.mrr.toFixed(2)} UF/mes</td><td style="font-size:11px;color:#0a9e72;">${r.comAg.toFixed(2)} UF</td></tr>`).join('');
}

// ── Feature 4: Tamaño de edificio ──
function getSizeLabel(units){
  if(units<50)return{label:'Pequeño (<50 unid.)',color:'#7050b8'};
  if(units<=200)return{label:'Mediano (50–200 unid.)',color:'#1a5ac4'};
  return{label:'Grande (>200 unid.)',color:'#0a9e72'};
}

// ── Feature 5: Historial ──
function saveToHistorial(){
  let costoTotal=0;
  if(sel.saas&&!tiene.saas)costoTotal+=SAAS_MES;
  if(sel.cito)costoTotal+=costoCitoMes;
  if(sel.acceso&&!tiene.acceso)costoTotal+=ACCESO_MES;
  const entry={
    id:Date.now(),
    fecha:new Date().toLocaleDateString('es-CL'),
    nombre:document.getElementById('nombre-comunidad').value.trim()||'Sin nombre',
    aseg:document.getElementById('aseguradora').value||'—',
    ma:parseFloat(document.getElementById('ma-text').value),
    cob,com:parseFloat(document.getElementById('comision').value),
    units:parseInt(document.getElementById('units-text').value),
    sel:{...sel},tiene:{...tiene},
    mrr:parseFloat(mrr.toFixed(2)),
    remanente:parseFloat((mrr-costoTotal).toFixed(2))
  };
  const h=JSON.parse(localStorage.getItem('sim_historial')||'[]');
  h.unshift(entry);if(h.length>20)h.pop();
  localStorage.setItem('sim_historial',JSON.stringify(h));
  if(showHistorial)renderHistorial();
  const btn=document.getElementById('btn-guardar');
  btn.textContent='✓ Guardado';
  setTimeout(()=>{btn.textContent='Guardar';},1500);
}
function loadFromHistorial(id){
  const h=JSON.parse(localStorage.getItem('sim_historial')||'[]');
  const e=h.find(x=>x.id===id);if(!e)return;
  document.getElementById('nombre-comunidad').value=e.nombre==='Sin nombre'?'':e.nombre;
  if(e.aseg&&e.aseg!=='—')document.getElementById('aseguradora').value=e.aseg;
  document.getElementById('ma').value=Math.min(e.ma,400000);
  document.getElementById('ma-text').value=e.ma;
  document.getElementById('comision').value=e.com;
  document.getElementById('units').value=Math.min(e.units,1000);
  document.getElementById('units-text').value=e.units;
  cob=e.cob;
  document.getElementById('btn-is').className='cob-btn'+(cob==='is'?' active-is':'');
  document.getElementById('btn-i').className='cob-btn'+(cob==='i'?' active-i':'');
  tiene={...e.tiene};sel={...e.sel};
  ['saas','cito','acceso'].forEach(p=>{document.getElementById('tog-'+p).className=tiene[p]?'prod-toggle on-'+p:'prod-toggle';});
  recalc();
}
function renameHistorial(id,el){
  const nombre=el.textContent.trim()||'Sin nombre';
  el.textContent=nombre;
  const h=JSON.parse(localStorage.getItem('sim_historial')||'[]');
  const entry=h.find(x=>x.id===id);
  if(entry){entry.nombre=nombre;localStorage.setItem('sim_historial',JSON.stringify(h));}
}
function deleteFromHistorial(id,ev){
  ev.stopPropagation();
  const h=JSON.parse(localStorage.getItem('sim_historial')||'[]').filter(x=>x.id!==id);
  localStorage.setItem('sim_historial',JSON.stringify(h));
  renderHistorial();
}
function toggleHistorial(){
  showHistorial=!showHistorial;
  document.getElementById('historial-wrap').style.display=showHistorial?'block':'none';
  document.getElementById('btn-historial').textContent=showHistorial?'Ocultar historial':'Ver historial';
  if(showHistorial)renderHistorial();
}
function renderHistorial(){
  const h=JSON.parse(localStorage.getItem('sim_historial')||'[]');
  const wrap=document.getElementById('historial-list');if(!wrap)return;
  if(h.length===0){wrap.innerHTML='<div class="hist-empty">No hay simulaciones guardadas</div>';return;}
  wrap.innerHTML=h.map(e=>`<div class="hist-item" onclick="loadFromHistorial(${e.id})"><div class="hist-info"><div class="hist-nombre" contenteditable="true" onclick="event.stopPropagation()" onblur="renameHistorial(${e.id},this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${e.nombre}</div><div class="hist-meta">${e.fecha} · ${e.aseg} · ${(e.ma||0).toLocaleString('es-CL')} UF</div><div class="hist-rem" style="color:${e.remanente>=0?'#0a9e72':'#d63228'}">${e.mrr.toFixed(2)} UF/mes · Rem: ${(e.remanente>=0?'+':'')}${e.remanente.toFixed(2)} UF/mes</div></div><button class="hist-del" onclick="deleteFromHistorial(${e.id},event)">✕</button></div>`).join('');
}

// ── Feature 6: Copiar pitch ──
function copyPitch(){
  const text=document.getElementById('pitch-box').textContent;
  navigator.clipboard.writeText(text).then(()=>{
    const btn=document.getElementById('btn-copy-pitch');
    btn.textContent='✓ Copiado';
    setTimeout(()=>{btn.textContent='Copiar';},1500);
  }).catch(()=>{
    const btn=document.getElementById('btn-copy-pitch');
    btn.textContent='Error — copia manual';
    setTimeout(()=>{btn.textContent='Copiar';},2500);
  });
}

// ── Comparador de combinaciones de beneficios ──
let showCompBen=false;
function toggleComparadorBeneficios(){
  showCompBen=!showCompBen;
  document.getElementById('comp-ben-wrap').style.display=showCompBen?'block':'none';
  document.getElementById('btn-comp-ben').textContent=showCompBen?'Ocultar combinaciones':'Comparar combinaciones de beneficios';
  if(showCompBen)renderComparadorBeneficios();
}
function renderComparadorBeneficios(){
  if(!showCompBen)return;
  const comAgente=getComisionAgente(mrr);
  const combos=[
    {s:false,c:false,a:false},
    {s:true, c:false,a:false},
    {s:false,c:true, a:false},
    {s:false,c:false,a:true},
    {s:true, c:true, a:false},
    {s:true, c:false,a:true},
    {s:false,c:true, a:true},
    {s:true, c:true, a:true},
  ];
  const rows=combos
    .filter(o=>!(o.s&&tiene.saas)&&!(o.c&&tiene.cito)&&!(o.a&&tiene.acceso))
    .map(o=>{
      const nombre=[o.s?'SaaS':null,o.c?'Citofonía':null,o.a?'Acceso':null].filter(Boolean).join(' + ')||'Sin beneficios';
      const costoMes1=comAgente+(o.s?SAAS_MES:0)+(o.c?costoCitoMes:0)+(o.a?ACCESO_MES:0);
      const remEstable=mrr-(o.s?SAAS_MES:0);
      let acum=0,be=null;
      for(let m=1;m<=36;m++){
        let cm=0;
        if(m===1)cm+=comAgente;
        if(o.s&&m<=12)cm+=SAAS_MES;
        if(o.c&&m<=3)cm+=costoCitoMes;
        if(o.a&&m<=6)cm+=ACCESO_MES;
        acum+=mrr-cm;
        if(acum>=0&&be===null)be=m;
      }
      const isCurrent=(o.s===sel.saas&&o.c===sel.cito&&o.a===sel.acceso);
      return{nombre,costoMes1,remEstable,be,isCurrent};
    })
    .sort((a,b)=>b.remEstable-a.remEstable);
  document.getElementById('comp-ben-tbody').innerHTML=rows.map(r=>`
    <tr class="${r.isCurrent?'comp-current':''}">
      <td>${r.nombre}${r.isCurrent?' <span class="comp-badge">actual</span>':''}</td>
      <td style="color:#d63228;">−${r.costoMes1.toFixed(2)} UF</td>
      <td style="color:${r.remEstable>=0?'#0a9e72':'#d63228'};font-weight:500;">${(r.remEstable>=0?'+':'')}${r.remEstable.toFixed(2)} UF/mes</td>
      <td style="color:#1a5ac4;">${r.be?'Mes '+r.be:'>36m'}</td>
    </tr>`).join('');
}

// ── Notas por comunidad ──
function getCNNotes(){return JSON.parse(localStorage.getItem('cn_notas')||'{}');}
function saveCNNote(key,text){
  const notes=getCNNotes();
  if(text.trim())notes[key]=text.trim();else delete notes[key];
  localStorage.setItem('cn_notas',JSON.stringify(notes));
}
function toggleCNNote(el,key){
  const ta=el.nextElementSibling;
  el.style.display='none';ta.style.display='block';ta.focus();
}
function saveCNNoteEl(ta,key){
  saveCNNote(key,ta.value);
  const preview=ta.previousElementSibling;
  const text=ta.value.trim();
  preview.textContent=text||'+';
  preview.className='cn-note-preview'+(text?'':' empty');
  ta.style.display='none';preview.style.display='';
}



// ── Cards ──
function renderCards(){
  const canCito=costoCitoMes>0&&mrr>=costoCitoMes,canAcceso=mrr>0&&mrr>=ACCESO_MES;
  const saasCard=document.getElementById('card-saas'),saasTag=document.getElementById('tag-saas');
  if(tiene.saas){saasCard.className='b-card locked';sel.saas=false;saasTag.className='b-tag tg-lock';saasTag.textContent='Ya tiene SaaS';}
  else if(mrr>=SAAS_MES){saasCard.className='b-card saas-u unlocked'+(sel.saas?' sel':'');saasTag.className='b-tag tg-saas';saasTag.textContent='Disponible';}
  else{saasCard.className='b-card locked';sel.saas=false;saasTag.className='b-tag tg-lock';saasTag.textContent='Necesitas +'+(SAAS_MES-mrr).toFixed(2)+' UF/mes';}
  const ccCard=document.getElementById('card-cito'),ccTag=document.getElementById('tag-cito');
  document.getElementById('cost-cito').innerHTML='Costo Seguro Intercompany: <strong>'+costoCito3m.toFixed(2)+' UF</strong> (3 meses)';
  if(tiene.cito){ccCard.className='b-card locked';sel.cito=false;ccTag.className='b-tag tg-lock';ccTag.textContent='Ya tiene Citofonía CF';}
  else if(!tiene.saas&&!sel.saas){ccCard.className='b-card locked';sel.cito=false;ccTag.className='b-tag tg-lock';ccTag.textContent='Requiere SaaS CF primero';}
  else if(canCito){ccCard.className='b-card cito-u unlocked'+(sel.cito?' sel':'');ccTag.className='b-tag tg-cito';ccTag.textContent='Disponible';}
  else{ccCard.className='b-card locked';sel.cito=false;ccTag.className='b-tag tg-lock';ccTag.textContent='Necesitas +'+(costoCitoMes-mrr).toFixed(2)+' UF/mes';}
  const acCard=document.getElementById('card-acceso'),acTag=document.getElementById('tag-acceso');
  if(tiene.acceso){acCard.className='b-card locked';sel.acceso=false;acTag.className='b-tag tg-lock';acTag.textContent='Ya tiene Control de Acceso CF';}
  else if(canAcceso){acCard.className='b-card acceso-u unlocked'+(sel.acceso?' sel':'');acTag.className='b-tag tg-acceso';acTag.textContent='Disponible';}
  else{acCard.className='b-card locked';sel.acceso=false;acTag.className='b-tag tg-lock';acTag.textContent='Necesitas +'+(ACCESO_MES-mrr).toFixed(2)+' UF/mes';}
}

// ── Resumen ──
function renderResumen(){
  const content=document.getElementById('resumen-content'),anyBenefit=sel.saas||sel.cito||sel.acceso;
  if(!anyBenefit){content.innerHTML='<div class="empty">Selecciona al menos un beneficio para ver el resumen</div>';document.getElementById('rent-section').style.display='none';return;}
  const comAgente=getComisionAgente(mrr);
  let costoTotal=0,costoDetalle=[];
  if(sel.saas){costoTotal+=SAAS_MES;costoDetalle.push({label:'SaaS',val:SAAS_MES});}
  if(sel.cito){costoTotal+=costoCitoMes;costoDetalle.push({label:'Citofonía',val:costoCitoMes});}
  if(sel.acceso){costoTotal+=ACCESO_MES;costoDetalle.push({label:'Control de acceso',val:ACCESO_MES});}
  const remMes1=mrr-comAgente-costoTotal;
  const remEstable=mrr-costoTotal;
  let semClass,dotClass,semMsg;
  if(remEstable<0){semClass='sem-red';dotClass='sem-dot-red';semMsg='MRR insuficiente para cubrir costos';}
  else if(remEstable<0.5){semClass='sem-yellow';dotClass='sem-dot-yellow';semMsg='Margen ajustado — considera revisar';}
  else{semClass='sem-green';dotClass='sem-dot-green';semMsg='Operación rentable para la corredora';}
  content.innerHTML=
    `<div class="semaforo ${semClass}"><div class="sem-dot ${dotClass}"></div><div class="sem-text">${semMsg}</div><div class="sem-val" style="color:${remEstable>=0?'#0a9e72':'#d63228'}">${(remEstable>=0?'+':'')}${fmtUF(remEstable)} UF/mes</div></div>`+
    `<div class="res-row"><span>MRR generado</span><span class="val">${fmtUF(mrr)} UF/mes</span></div>`+
    `<div class="res-row"><span>Comisión agente <span class="tag-once">Solo mes 1</span></span><span class="val red">−${fmtUF(comAgente)} UF</span></div>`+
    costoDetalle.map(d=>`<div class="res-row"><span>${d.label}</span><span class="val red">−${fmtUF(d.val)} UF/mes</span></div>`).join('')+
    `<div class="res-row"><span>Costo total beneficios</span><span class="val red">−${fmtUF(costoTotal)} UF/mes</span></div>`+
    (()=>{const dif=costoTotal>0?mrr/costoTotal:null;const ok=dif!==null&&dif>=umbralDiferencial;const col=dif===null?'#5570a0':ok?'#0a9e72':'#d63228';const difStr=dif!==null?fmtUF(dif,2)+'x':'—';const badge=dif===null?'—':ok?'✅ Rentable: Rinde '+difStr+' lo que cuesta el beneficio':'❌ No rentable: Rinde solo '+difStr+' lo que cuesta el beneficio';return`<div class="res-row" style="border-top:1px solid #eef0f8;margin-top:4px;padding-top:6px;"><span><strong>Diferencial</strong></span><span style="color:${col};font-size:13px;font-weight:600;text-align:right;">${badge}</span></div>`;})()+
    `<div class="res-row" style="border-top:1px solid #eef0f8;margin-top:4px;padding-top:6px;"><span><strong>Remanente neto (mes 1)</strong></span><span class="val ${remMes1>=0?'green':'red'}">${(remMes1>=0?'+':'')}${fmtUF(remMes1)} UF</span></div>`+
    `<div class="res-row"><span><strong>Remanente neto (mes 2+)</strong></span><span class="val ${remEstable>=0?'green':'red'}">${(remEstable>=0?'+':'')}${fmtUF(remEstable)} UF/mes</span></div>`;
  renderRentabilidad();
}

// ── Rentabilidad ──
function renderRentabilidad(){
  const anyBenefit=sel.saas||sel.cito||sel.acceso,rentSec=document.getElementById('rent-section');
  if(!anyBenefit){rentSec.style.display='none';return;}
  rentSec.style.display='block';
  const comAgente=getComisionAgente(mrr);
  const labels=[],dataMes=[];
  for(let m=1;m<=projPeriod;m++){
    labels.push('M'+m);
    let costoMes=0;
    if(m===1)costoMes+=comAgente;
    if(sel.saas&&!tiene.saas&&m<=12)costoMes+=SAAS_MES;
    if(sel.cito&&m<=3)costoMes+=costoCitoMes;
    if(sel.acceso&&!tiene.acceso&&m<=6)costoMes+=ACCESO_MES;
    dataMes.push(parseFloat((mrr-costoMes).toFixed(2)));
  }
  let breakEvenMes=null,acum=0;
  for(let i=0;i<dataMes.length;i++){acum+=dataMes[i];if(acum>=0&&breakEvenMes===null)breakEvenMes=i+1;}
  let costoMes2=0;
  if(sel.saas&&!tiene.saas)costoMes2+=SAAS_MES;
  if(sel.cito)costoMes2+=costoCitoMes;
  if(sel.acceso&&!tiene.acceso)costoMes2+=ACCESO_MES;
  const remEstable=mrr-costoMes2;
  document.getElementById('rem-v').textContent=(remEstable>=0?'+':'')+fmtUF(remEstable)+' UF/mes';
  document.getElementById('rem-v').style.color=remEstable>=0?'#0a9e72':'#d63228';
  document.getElementById('rem-sub').textContent='Remanente estable (mes 2+)';
  if(breakEvenMes){document.getElementById('be-v').textContent='Mes '+breakEvenMes;document.getElementById('be-v').style.color='#1a5ac4';document.getElementById('be-sub').textContent=breakEvenMes===1?'Rentable desde el primer mes':'Recupera inversión en mes '+breakEvenMes;}
  else{document.getElementById('be-v').textContent='>'+projPeriod+'m';document.getElementById('be-v').style.color='#d63228';document.getElementById('be-sub').textContent='No se recupera en el período';}
  const totalPeriodo=dataMes.reduce((a,b)=>a+b,0);
  document.getElementById('ltv-v').textContent=(totalPeriodo>=0?'+':'')+fmtUF(totalPeriodo)+' UF';
  document.getElementById('ltv-v').style.color=totalPeriodo>=0?'#0a9e72':'#d63228';
  document.getElementById('ltv-label').textContent='Ganancia neta '+projPeriod+' meses';
  document.getElementById('ltv-sub').textContent='Total acumulado al mes '+projPeriod;
  const noteParts=[];
  noteParts.push('Comisión al agente de <strong>'+fmtUF(comAgente)+' UF</strong> descontada en el mes 1.');
  if(sel.cito)noteParts.push('Citofonía absorbe <strong>'+fmtUF(costoCito3m)+' UF</strong> en los primeros 3 meses.');
  if(sel.saas&&!tiene.saas)noteParts.push('SaaS cuesta <strong>1,20 UF/mes</strong> los primeros 12 meses.');
  if(sel.acceso&&!tiene.acceso)noteParts.push('CF absorbe instalación Control de Acceso: <strong>25 UF en 6 cuotas</strong> (≈4,17 UF/mes × 6 meses). Admin paga 2 UF/mes desde el inicio.');
  if(remEstable>0)noteParts.push('Desde el mes 2, la corredora retiene <strong>'+fmtUF(remEstable)+' UF/mes</strong> netos.');
  document.getElementById('rent-note').innerHTML=noteParts.join(' ');
  const colors=dataMes.map(v=>v>=0?'rgba(10,158,114,0.75)':'rgba(214,50,40,0.75)');
  const borderColors=dataMes.map(v=>v>=0?'#0a9e72':'#d63228');
  document.getElementById('chart-wrap').style.height=projPeriod===24?'260px':'220px';
  if(projChart)projChart.destroy();
  projChart=new Chart(document.getElementById('projChart'),{type:'bar',data:{labels,datasets:[{label:'Ganancia mensual (UF)',data:dataMes,backgroundColor:colors,borderColor:borderColors,borderWidth:1.5,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+ctx.parsed.y.toFixed(2)+' UF ese mes'}}},scales:{x:{grid:{color:'rgba(26,90,196,0.06)'},ticks:{color:'#5570a0',font:{size:projPeriod===24?9:11},autoSkip:false,maxRotation:projPeriod===24?45:0}},y:{grid:{color:'rgba(26,90,196,0.06)'},ticks:{color:'#5570a0',font:{size:11},callback:v=>v.toFixed(1)+' UF'}}}}});
  document.getElementById('proj-legend').innerHTML='<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#5570a0;margin-right:16px;"><span style="width:10px;height:10px;border-radius:2px;background:#0a9e72;display:inline-block;"></span>Ganancia ese mes</span><span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#5570a0;"><span style="width:10px;height:10px;border-radius:2px;background:#d63228;display:inline-block;"></span>Déficit ese mes</span>';
}

function setPeriod(p){projPeriod=p;['12','24','36'].forEach(x=>document.getElementById('btn-'+x).className='period-btn'+(p==x?' active-period':''));renderRentabilidad();}
function setUmbral(v){umbralDiferencial=Math.max(0.5,Math.min(10,parseFloat(v)||2.0));const fmt=umbralDiferencial.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});const g=document.getElementById('umbral-global');if(g)g.value=umbralDiferencial;const d=document.getElementById('umbral-display');if(d)d.textContent=fmt;const d2=document.getElementById('bbdd-umbral-display');if(d2)d2.textContent=fmt;const desc=document.getElementById('umbral-desc');if(desc)desc.innerHTML='Genera desde '+fmt+' veces lo que<br>cuesta el beneficio.';renderResumen();if(bbddFilterEstado==='califica')renderBBDD();}
function setBBDDUmbral(v){setUmbral(v);}
function exportBBDDExcel(){
  if(!bbddFilteredRows.length){alert('No hay comunidades para exportar.');return;}
  const filterNames={'all':'Todas','activo':'Activo','inactivo':'Inactivo','nunca':'Nunca','caso1':'Caso 1','caso2':'Caso 2','caso3':'Caso 3','califica':'Califica'};
  const data=bbddFilteredRows.map(r=>{
    const ratio=r.saasCost>0?parseFloat((r.mrrSeg/r.saasCost).toFixed(2)):0;
    const califica=r.saasCost>0&&ratio>=umbralDiferencial;
    const oportunidad=r.netGain>=1?'Alta':r.netGain>=0?'Media':'Baja';
    return{
      'Comunidad':r.nombre,
      'RUT':r.rut,
      'Estado seguro':r.estadoSeguro,
      'Cobertura':r.cob==='is'?'Inc.+Sismo':'Incendio',
      'MA (UF)':parseFloat(r.ma.toFixed(2)),
      'MRR seguro (UF/mes)':parseFloat(r.mrrSeg.toFixed(2)),
      'Precio lista SaaS (UF/mes)':parseFloat(r.precioLista.toFixed(2)),
      'Precio intercompany (UF/mes)':parseFloat(r.saasCost.toFixed(2)),
      'Ratio MRR/SaaS':ratio,
      'Remanente corredora (UF/mes)':parseFloat(r.netGain.toFixed(2)),
      'Oportunidad':oportunidad+(califica?' ✅':''),
    };
  });
  const ws=XLSX.utils.json_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Comunidades');
  const fname='bbdd_cf_'+(filterNames[bbddFilterEstado]||bbddFilterEstado)+'_'+new Date().toISOString().slice(0,10)+'.xlsx';
  XLSX.writeFile(wb,fname);
}

// ── Pitch ──
function updatePitch(){
  const nombre=document.getElementById('nombre-comunidad').value.trim()||'su comunidad';
  const anyPaid=sel.saas||sel.cito||sel.acceso;
  const anyFree=[...document.querySelectorAll('#free-list .free-item')].some(item=>{
    const chk=item.querySelector('.free-check');
    return chk&&chk.classList.contains('checked')&&item.style.display!=='none';
  });
  const pitchSec=document.getElementById('pitch-section');
  if(!anyPaid&&!anyFree){pitchSec.style.display='none';return;}
  pitchSec.style.display='block';
  const parts=[];
  if(sel.saas)parts.push('SaaS de gestión de gastos comunes gratis por 12 meses');
  if(sel.cito)parts.push('Citofonía CF con 2 meses gratis y celular incluido');
  if(sel.acceso)parts.push('Control de Acceso Pack 1 (QR + Apertura Remota) — CF paga la instalación (25 UF), tú solo pagas 2 UF/mes');
  document.querySelectorAll('#free-list .free-item').forEach(item=>{
    const chk=item.querySelector('.free-check');
    if(chk&&chk.classList.contains('checked')&&item.style.display!=='none')
      parts.push(item.getAttribute('data-label')||item.querySelector('.free-text').textContent.trim().toLowerCase());
  });
  const aseg=document.getElementById('aseguradora').value;
  const asegStr=aseg&&aseg!==''?' con '+aseg:'';
  let pitch='';
  if(parts.length===0)pitch='Selecciona un beneficio para generar el pitch.';
  else if(parts.length===1)pitch='Al contratar tu seguro'+asegStr+', "'+nombre+'" accede a '+parts[0]+' — sin costo adicional para la Comunidad.';
  else{const ultimo=parts[parts.length-1];pitch='Al contratar tu seguro'+asegStr+', "'+nombre+'" accede a '+parts.slice(0,-1).join(', ')+' y '+ultimo+' — todo sin costo adicional para la Comunidad.';}
  document.getElementById('pitch-box').textContent=pitch;
}

function updateApoyo(){
  const apoyoSection=document.getElementById('apoyo-section'),linkCito=document.getElementById('link-cito'),linkAcceso=document.getElementById('link-acceso');
  const showCito=sel.cito&&!tiene.cito,showAcceso=sel.acceso&&!tiene.acceso;
  linkCito.style.display=showCito?'inline-flex':'none';
  linkAcceso.style.display=showAcceso?'inline-flex':'none';
  apoyoSection.style.display=(showCito||showAcceso)?'flex':'none';
}

// ── Recalc principal ──
function recalc(){
  const ma=parseFloat(document.getElementById('ma-text').value)||100000;
  const com=parseFloat(document.getElementById('comision').value)/100;
  const units=parseInt(document.getElementById('units-text').value)||100;
  document.getElementById('comision-v').textContent=(com*100).toFixed(1)+'%';
  const tasa=cob==='is'?tasaIS:tasaI,prima=ma*tasa;
  mrr=prima*com/12;
  document.getElementById('prima-v').textContent=fmtUF(prima)+' UF';
  document.getElementById('mrr-v').textContent=fmtUF(mrr)+' UF/mes';
  document.getElementById('mrr-anual-v').textContent=fmtUF(mrr*12)+' UF/año';
  const tramo=getTramo(units);costoCito3m=tramo.s;costoCitoMes=costoCito3m/3;
  const aseg=document.getElementById('aseguradora').value;
  document.getElementById('rc-item').style.display=(aseg==='BCI Seguros'||aseg==='Mapfre')?'flex':'none';
  // Feature 4: tamaño
  const size=getSizeLabel(units);
  const badge=document.getElementById('size-badge');
  badge.textContent=size.label;badge.style.color=size.color;badge.style.background=size.color+'18';
  renderCards();renderResumen();updatePitch();updateApoyo();
  renderComparador();
  renderComparadorBeneficios();
}

// ── Análisis BBDD ──
let bbddComunidades=[],bbddCob='is',bbddTasaIS=0.00160,bbddTasaI=0.00050,bbddDefaultIntercompany=1.20,bbddChurn=0.30,bbddFilterEstado='all',bbddSearch='',bbddFilteredRows=[];
const UF_CLP=36000,USD_CLP=900;
function fmtCLP(uf){return'$'+Math.round(uf*UF_CLP).toLocaleString('es-CL')+' CLP';}
function fmtUSD(uf){return'US$ '+Math.round(uf*UF_CLP/USD_CLP).toLocaleString('en-US');}
function fmtUF(v,dec=2){return v.toLocaleString('es-CL',{minimumFractionDigits:dec,maximumFractionDigits:dec});}
function handleBBDDFile(e){const f=e.target.files[0];if(!f)return;processBBDDFile(f);}
function handleBBDDDragOver(e){e.preventDefault();e.stopPropagation();document.getElementById('bbdd-dropzone').classList.add('drag-over');document.getElementById('bbdd-drop-icon').textContent='📥';}
function handleBBDDDragLeave(e){e.preventDefault();e.stopPropagation();document.getElementById('bbdd-dropzone').classList.remove('drag-over');document.getElementById('bbdd-drop-icon').textContent=bbddComunidades.length?'✅':'📂';}
function handleBBDDDrop(e){e.preventDefault();e.stopPropagation();document.getElementById('bbdd-dropzone').classList.remove('drag-over');const f=e.dataTransfer.files[0];if(!f)return;processBBDDFile(f);}
function processBBDDFile(file){const ext=file.name.split('.').pop().toLowerCase();setBBDDFilePill(file.name);if(ext==='csv'){const r=new FileReader();r.onload=e=>parseBBDDCSV(e.target.result);r.readAsText(file,'UTF-8');}else{const r=new FileReader();r.onload=e=>parseBBDDExcel(e.target.result);r.readAsArrayBuffer(file);}}
function setBBDDFilePill(name){const dz=document.getElementById('bbdd-dropzone');dz.classList.add('has-file');document.getElementById('bbdd-drop-icon').textContent='✅';document.getElementById('bbdd-drop-title').textContent='Archivo cargado';document.getElementById('bbdd-drop-sub').textContent='Puedes reemplazarlo arrastrando otro archivo';document.getElementById('bbdd-file-pill-wrap').innerHTML=`<div class="file-pill pop-in">📄 ${name} <span class="file-pill-remove" onclick="clearBBDDFile(event)">✕</span></div>`;}
function clearBBDDFile(e){e.stopPropagation();bbddComunidades=[];const dz=document.getElementById('bbdd-dropzone');dz.classList.remove('has-file');document.getElementById('bbdd-drop-icon').textContent='📂';document.getElementById('bbdd-drop-title').textContent='Carga la BBDD de Comunidad Feliz';document.getElementById('bbdd-drop-sub').textContent='CSV o Excel con comunidades, plan SaaS y monto asegurado';document.getElementById('bbdd-file-pill-wrap').innerHTML='';document.getElementById('bbdd-table-section').style.display='none';document.getElementById('bbdd-empty').style.display='block';renderDashboard();document.getElementById('bbdd-file').value='';}
function downloadBBDDTemplate(){const csv='Nombre Comunidad,Rut Comunidad,Cobertura (IS/I),Monto Asegurado (UF),Tiene SaaS (SI/NO),Precio lista SaaS (UF),Precio Intercompany SaaS (UF)\nEdificio Con SaaS,76.123.456-7,IS,150000,SI,1.5,1.5\nEdificio Con SaaS Menor,76.234.567-8,I,80000,SI,1.2,1.2\nEdificio Sin SaaS,76.345.678-9,IS,200000,NO,0,1.2\n';const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bbdd_comunidades_cf.csv';a.click();}
function parseBBDDCSV(text){
  text=text.replace(/^﻿/,'');
  const lines=text.trim().split(/\r?\n/),data=[];
  if(lines.length<2)return;
  // Detectar delimitador , vs ;
  const delim=lines[0].includes(';')?';':',';
  const splitRow=line=>line.split(delim).map(c=>c.trim().replace(/"/g,''));
  const headers=splitRow(lines[0]).map(h=>norm(h));
  const iNombre  =headers.findIndex(h=>h.includes('nombre'));
  const iRut     =headers.findIndex(h=>h.includes('rut'));
  const iMA      =headers.findIndex(h=>h==='ma'||h.includes('monto')||h.includes('asegurado'));
  const iCob     =headers.findIndex(h=>h.includes('cobertura'));
  const iTieneSaas=headers.findIndex(h=>h.includes('tienesa')||h.includes('tiene'));
  const iLista   =headers.findIndex(h=>h.includes('lista')||(h.includes('precio')&&!h.includes('inter')&&!h.includes('monto')));
  const iInter   =headers.findIndex(h=>h.includes('inter')||h.includes('costo'));
  const iEstado  =headers.findIndex(h=>h.includes('estado'));
  const col=(cols,idx,def)=>idx>=0&&cols[idx]?cols[idx]:def;
  for(let i=1;i<lines.length;i++){
    const cols=splitRow(lines[i]);
    if(cols.length<2||!cols[iNombre>=0?iNombre:0])continue;
    const nombre =col(cols,iNombre,'');
    const rut    =col(cols,iRut,'—');
    const ma     =parseFloat(col(cols,iMA,'0'))||0;
    const cobRaw =(col(cols,iCob,'')).toUpperCase().trim();
    const cob    =cobRaw==='I'?'i':'is';
    const lista  =parseFloat(col(cols,iLista,'1.20'))||1.20;
    const tieneSaas=iTieneSaas>=0
      ?(col(cols,iTieneSaas,'')).toUpperCase().trim()==='SI'
      :parseFloat(col(cols,iInter,'0'))>0;
    const estadoRaw=(col(cols,iEstado,'')).toLowerCase().trim();
    const estadoSeguro=estadoRaw==='activo'?'activo':estadoRaw==='inactivo'?'inactivo':'nunca';
    data.push({nombre,rut,cob,tieneSaas,ma,precioLista:lista,estadoSeguro});
  }
  bbddComunidades=data;renderBBDD();
}
function parseBBDDExcel(buffer){
  if(typeof XLSX==='undefined'){alert('Librería Excel no cargada.');return;}
  const wb=XLSX.read(buffer,{type:'array'});
  if(!wb.SheetNames||wb.SheetNames.length===0){console.warn('Excel sin hojas');bbddComunidades=[];renderBBDD();return;}
  const sheetName=wb.SheetNames.find(n=>/bbdd|comunidad/i.test(n))||wb.SheetNames[0];
  const ws=wb.Sheets[sheetName];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1}),data=[];
  if(rows.length<2){bbddComunidades=data;renderBBDD();return;}
  const headers=rows[0].map(h=>norm(h||''));
  const iNombre  =headers.findIndex(h=>h.includes('nombre'));
  const iRut     =headers.findIndex(h=>h.includes('rut'));
  const iMA      =headers.findIndex(h=>h==='ma'||h.includes('monto')||h.includes('asegurado'));
  const iCob     =headers.findIndex(h=>h.includes('cobertura'));
  const iTieneSaas=headers.findIndex(h=>h.includes('tienesa')||h.includes('tiene'));
  const iLista   =headers.findIndex(h=>h.includes('lista')||(h.includes('precio')&&!h.includes('inter')&&!h.includes('monto')));
  const iInter   =headers.findIndex(h=>h.includes('inter')||h.includes('costo'));
  const iEstado  =headers.findIndex(h=>h.includes('estado'));
  const col=(r,idx,def)=>{if(idx<0)return def;const v=r[idx];return(v!==undefined&&v!=='')?v:def;};
  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    if(!r||!r[iNombre>=0?iNombre:0])continue;
    const nombre =String(col(r,iNombre,'')||'');
    const rut    =String(col(r,iRut,'—')||'—');
    const ma     =parseFloat(col(r,iMA,0))||0;
    const cobRaw =String(col(r,iCob,'')).toUpperCase().trim();
    const cob    =cobRaw==='I'?'i':'is';
    const lista  =parseFloat(col(r,iLista,1.20))||1.20;
    const tieneSaas=iTieneSaas>=0
      ?String(col(r,iTieneSaas,'')).toUpperCase().trim()==='SI'
      :parseFloat(col(r,iInter,0))>0;
    const estadoSeguro=(()=>{const v=String(col(r,iEstado,'')||'').toLowerCase().trim();return v==='activo'?'activo':v==='inactivo'?'inactivo':'nunca';})();
    data.push({nombre,rut,cob,tieneSaas,ma,precioLista:lista,estadoSeguro});
  }
  bbddComunidades=data;renderBBDD();
}
function setBBDDcob(c){bbddCob=c;document.getElementById('bbdd-btn-is').className='cob-btn'+(c==='is'?' active-is':'');document.getElementById('bbdd-btn-i').className='cob-btn'+(c==='i'?' active-i':'');renderBBDD();}
function updateBBDDIntercompany(){bbddDefaultIntercompany=parseFloat(document.getElementById('bbdd-intercompany').value)||1.20;renderBBDD();}
function updateBBDDTasa(){bbddTasaIS=(parseFloat(document.getElementById('bbdd-tasa-is').value)||0.160)/100;bbddTasaI=(parseFloat(document.getElementById('bbdd-tasa-i').value)||0.050)/100;renderBBDD();}
function stepBBDDTasa(id,dir){const input=document.getElementById(id);const val=parseFloat(input.value)||0;input.value=Math.max(0.01,Math.min(1,parseFloat((val+dir*0.01).toFixed(4))));updateBBDDTasa();}
function updateBBDDComision(){document.getElementById('bbdd-comision-v').textContent=parseFloat(document.getElementById('bbdd-comision').value).toFixed(1)+'%';renderBBDD();}
function setBBDDEstadoFilter(val){
  bbddFilterEstado=val;
  document.querySelectorAll('.bbdd-estado-btn').forEach(b=>b.classList.toggle('active-period',b.dataset.val===val));
  renderBBDD();
}
function updateBBDDSearch(){
  bbddSearch=(document.getElementById('bbdd-search').value||'').trim().toLowerCase();
  const clr=document.getElementById('bbdd-search-clear');
  if(clr)clr.style.display=bbddSearch?'block':'none';
  renderBBDD();
}
function clearBBDDSearch(){
  bbddSearch='';
  const el=document.getElementById('bbdd-search');if(el)el.value='';
  const clr=document.getElementById('bbdd-search-clear');if(clr)clr.style.display='none';
  renderBBDD();
}
function updateBBDDChurn(){
  const v=parseFloat(document.getElementById('bbdd-churn').value)||0;
  bbddChurn=v/100;
  document.getElementById('bbdd-churn-num').value=v;
  renderBBDD();
}
function syncBBDDChurnFromText(){
  let v=parseFloat(document.getElementById('bbdd-churn-num').value);
  if(isNaN(v))v=0;
  v=Math.max(0,Math.min(50,v));
  document.getElementById('bbdd-churn-num').value=v;
  document.getElementById('bbdd-churn').value=v;
  bbddChurn=v/100;
  renderBBDD();
}
function renderDashboard(allRows){
  if(bbddComunidades.length===0){
    const emp=document.getElementById('bbdd-dashboard-empty');
    const db=document.getElementById('bbdd-dashboard');
    if(emp)emp.style.display='block';
    if(db)db.style.display='none';
    return;
  }
  const emp=document.getElementById('bbdd-dashboard-empty');
  const db=document.getElementById('bbdd-dashboard');
  if(emp)emp.style.display='none';
  if(!db)return;
  db.style.display='block';

  // Si se llama directamente (desde setView), computar las filas; si se llama desde renderBBDD, ya vienen computadas
  if(!allRows){
    const com=parseFloat(document.getElementById('bbdd-comision').value)/100;
    allRows=bbddComunidades.map(c=>{
      const cobr=c.cob||bbddCob,tasa=cobr==='is'?bbddTasaIS:bbddTasaI;
      const mrrSeg=c.ma>0?c.ma*tasa*com/12:0;
      const saasCost=c.tieneSaas?c.precioLista:bbddDefaultIntercompany;
      return{...c,cobr,mrrSeg,saasCost,netGain:mrrSeg-saasCost};
    });
  }

  const total=allRows.length;
  const nActivo   =allRows.filter(r=>r.estadoSeguro==='activo').length;
  const nInactivo =allRows.filter(r=>r.estadoSeguro==='inactivo').length;
  const nNunca    =allRows.filter(r=>r.estadoSeguro==='nunca').length;
  const nSweetspot=allRows.filter(r=>r.estadoSeguro==='nunca'&&r.tieneSaas).length;
  const nNuncaNoSaas=nNunca-nSweetspot;
  const pA=total?Math.round(nActivo/total*100):0;
  const pI=total?Math.round(nInactivo/total*100):0;
  const pS=total?Math.round(nSweetspot/total*100):0;
  const pN=Math.max(0,100-pA-pI-pS);

  // ── Hero cards ──
  document.getElementById('dash-total').textContent=total.toLocaleString('es-CL');
  document.getElementById('dash-activo').textContent=nActivo.toLocaleString('es-CL');
  document.getElementById('dash-activo-pct').textContent=pA+'% del universo';
  document.getElementById('dash-inactivo').textContent=nInactivo.toLocaleString('es-CL');
  document.getElementById('dash-inactivo-pct').textContent=pI+'% del universo';
  document.getElementById('dash-nunca').textContent=nNunca.toLocaleString('es-CL');
  document.getElementById('dash-nunca-pct').textContent=(pS+pN)+'% del universo';
  document.getElementById('dash-sweetspot').textContent=nSweetspot.toLocaleString('es-CL');

  // ── Stacked bar ──
  [{id:'dash-seg-activo',w:pA},{id:'dash-seg-inactivo',w:pI},{id:'dash-seg-sweet',w:pS},{id:'dash-seg-nosin',w:pN}]
    .forEach(s=>{const el=document.getElementById(s.id);if(el){el.style.width=s.w+'%';el.textContent=s.w>5?s.w+'%':'';} });

  // ── Métricas ──
  const mrrSweetspot=allRows.filter(r=>r.estadoSeguro==='nunca'&&r.tieneSaas).reduce((s,r)=>s+r.mrrSeg,0);
  const netTotal    =allRows.reduce((s,r)=>s+r.netGain,0);
  const nConSaaS    =allRows.filter(r=>r.tieneSaas).length;
  const upsellRows  =allRows.filter(r=>r.tieneSaas&&r.estadoSeguro!=='activo');
  const nUpsell     =upsellRows.length;
  const pctUpsell   =nConSaaS>0?Math.round(nUpsell/nConSaaS*100):0;
  const mrrUpsellBruto=upsellRows.reduce((s,r)=>s+r.mrrSeg,0);
  const netUpsell   =upsellRows.reduce((s,r)=>s+r.netGain,0);
  const arrUpsell   =netUpsell*12*(1-bbddChurn);
  const churnPctLabel=(bbddChurn*100).toFixed(0)+'%';

  // ── Callout barra ──
  document.getElementById('dash-callout').innerHTML=
    `🎯 <strong>${nSweetspot.toLocaleString('es-CL')} comunidades</strong> tienen SaaS activo pero nunca han contratado seguro — pipeline de menor fricción, la relación comercial ya existe. MRR potencial de ese segmento: <strong style="color:#1a5ac4;">${mrrSweetspot.toFixed(0)} UF/mes</strong> (${fmtCLP(mrrSweetspot)}/mes).`;

  // ── Rentabilidad del modelo ──
  const totalPrima=allRows.reduce((s,r)=>s+r.mrrSeg,0);
  const totalSaas=allRows.reduce((s,r)=>s+r.saasCost,0);
  const totalRem=allRows.reduce((s,r)=>s+r.netGain,0);
  const arrNetTotal=totalRem*12*(1-bbddChurn);
  const margenPct=totalPrima>0?Math.round(totalRem/totalPrima*100):0;
  const esRentable=totalRem>=0;
  const rentEl=document.getElementById('dash-rentabilidad');
  if(rentEl) rentEl.innerHTML=`
    <div style="margin-top:1.25rem;background:var(--surface);border:1px solid ${esRentable?'rgba(10,158,114,.25)':'rgba(214,50,40,.25)'};border-radius:14px;padding:1.1rem 1.4rem;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:10px;">Rentabilidad del modelo — cartera completa</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="text-align:center;min-width:110px;">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">Prima de seguros</div>
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#1a5ac4;">${totalPrima.toFixed(0)}<span style="font-size:12px;font-weight:500;"> UF/mes</span></div>
          <div style="font-size:10px;color:var(--muted);">${fmtCLP(totalPrima)}/mes</div>
        </div>
        <div style="font-size:20px;color:var(--muted);font-weight:300;">−</div>
        <div style="text-align:center;min-width:110px;">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">Costo SaaS intercompany</div>
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#d63228;">${totalSaas.toFixed(0)}<span style="font-size:12px;font-weight:500;"> UF/mes</span></div>
          <div style="font-size:10px;color:var(--muted);">${fmtCLP(totalSaas)}/mes</div>
        </div>
        <div style="font-size:20px;color:var(--muted);font-weight:300;">=</div>
        <div style="text-align:center;min-width:110px;">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">Remanente mensual</div>
          <div style="font-family:'Syne',sans-serif;font-size:26px;font-weight:900;color:${esRentable?'#0a9e72':'#d63228'};">${(totalRem>=0?'+':'')+totalRem.toFixed(0)}<span style="font-size:12px;font-weight:500;"> UF/mes</span></div>
          <div style="font-size:10px;color:var(--muted);">Margen ${margenPct}% sobre prima</div>
        </div>
        <div style="font-size:20px;color:var(--muted);font-weight:300;">×12 −churn</div>
        <div style="text-align:center;padding:10px 16px;background:${esRentable?'rgba(10,158,114,.08)':'rgba(214,50,40,.08)'};border-radius:10px;border-left:3px solid ${esRentable?'#0a9e72':'#d63228'};min-width:130px;">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">ARR neto · churn ${churnPctLabel}</div>
          <div style="font-family:'Syne',sans-serif;font-size:26px;font-weight:900;color:${esRentable?'#0a9e72':'#d63228'};">${(arrNetTotal>=0?'+':'')+Math.round(arrNetTotal).toLocaleString('es-CL')}<span style="font-size:12px;font-weight:500;"> UF/año</span></div>
          <div style="font-size:10px;color:var(--muted);">${fmtCLP(arrNetTotal)}/año</div>
        </div>
        <div style="margin-left:auto;padding:8px 16px;border-radius:100px;font-size:13px;font-weight:700;background:${esRentable?'#0a9e7218':'#d6322218'};color:${esRentable?'#0a9e72':'#d63228'};">
          ${esRentable?'✓ Modelo rentable':'⚠ Modelo no cierra'}
        </div>
      </div>
    </div>`;

  // ── ARR Hero ──
  const heroEl=document.getElementById('dash-arr-hero');
  if(heroEl) heroEl.innerHTML=`
    <div>
      <div class="dash-arr-label">ARR neto upsell — ${nConSaaS.toLocaleString('es-CL')} clientes SaaS · churn ${churnPctLabel}</div>
      <div class="dash-arr-val">${Math.round(arrUpsell).toLocaleString('es-CL')}<span class="dash-arr-unit">UF/año</span></div>
      <div class="dash-arr-currencies">${fmtCLP(arrUpsell)}/año &nbsp;·&nbsp; ${fmtUSD(arrUpsell)}/año</div>
    </div>
    <div class="dash-arr-breakdown">
      <div class="dash-arr-line">
        <span class="dash-arr-line-label">Comunidades CF con SaaS activo</span>
        <span class="dash-arr-line-val" style="color:#1a5ac4;">${nConSaaS.toLocaleString('es-CL')} en total</span>
      </div>
      <div class="dash-arr-line">
        <span class="dash-arr-line-label">De ellas, <strong>sin seguro</strong> → oportunidad de upsell directo (ya son clientes, la relación existe)</span>
        <span class="dash-arr-line-val" style="color:#1a5ac4;">${nUpsell.toLocaleString('es-CL')} <span style="font-weight:400;font-size:11px;">(${pctUpsell}% del total SaaS)</span></span>
      </div>
      <div class="dash-arr-line">
        <span class="dash-arr-line-label">Prima bruta si todas contratan seguro</span>
        <span class="dash-arr-line-val">${Math.round(mrrUpsellBruto).toLocaleString('es-CL')} UF/mes</span>
      </div>
      <div class="dash-arr-line">
        <span class="dash-arr-line-label">Neto holding (prima − SaaS intercompany) × 12 meses · churn ${churnPctLabel}</span>
        <span class="dash-arr-line-val" style="color:#7050b8;font-size:15px;">${Math.round(arrUpsell).toLocaleString('es-CL')} UF/año</span>
      </div>
    </div>`;

  // ── Casos breakdown — tarjetas seleccionables ──
  const caso3Rows=allRows.filter(r=>r.tieneSaas&&r.estadoSeguro==='activo');
  const caso1Rows=upsellRows;
  const caso2Rows=allRows.filter(r=>!r.tieneSaas&&r.estadoSeguro!=='activo');
  const netCaso3=caso3Rows.reduce((s,r)=>s+r.netGain,0);
  const netCaso2=caso2Rows.reduce((s,r)=>s+r.netGain,0);
  const arrCaso3=Math.round(Math.max(0,netCaso3)*12*(1-bbddChurn));
  const arrCaso1=Math.round(arrUpsell);
  const arrCaso2Corr=Math.round(netCaso2*12*(1-bbddChurn));
  const arrCaso2Saas=Math.round(caso2Rows.length*bbddDefaultIntercompany*12*(1-bbddChurn));
  const arrIncrementalTotal=arrCaso1+arrCaso2Corr+arrCaso2Saas;
  // guardar datos para selectDashCaso
  window._dashCasos={
    caso3:{rows:caso3Rows,arrCorr:arrCaso3,arrSaas:0,desc:'Comunidades con SaaS activo que ya contratan seguro. Son el punto de partida — la relación intercompany ya funciona hoy.',filtro:'caso3'},
    caso1:{rows:caso1Rows,arrCorr:arrCaso1,arrSaas:0,desc:'Clientes que ya pagan SaaS pero nunca contrataron seguro. La relación comercial existe — el upsell es el paso más directo y de menor fricción.',filtro:'caso1'},
    caso2:{rows:caso2Rows,arrCorr:arrCaso2Corr,arrSaas:arrCaso2Saas,desc:'Comunidades sin SaaS y sin seguro. El seguro sirve como puerta de entrada: al contratar, CF gana tanto el margen del seguro como el cliente de SaaS.',filtro:'caso2'},
    total:{arrCorr:arrCaso1+arrCaso2Corr,arrSaas:arrCaso2Saas,arrTotal:arrIncrementalTotal}
  };
  const casosEl=document.getElementById('dash-casos');
  if(!casosEl)return;
  _dashSelectedCasos.clear();
  casosEl.innerHTML=`
    <div style="margin-top:1.5rem;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#7050b8;text-transform:uppercase;margin-bottom:3px;">Potencial incremental del holding</div>
          <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--fg);">Selecciona uno o más casos para ver el detalle</div>
        </div>
        <div style="font-family:'Syne',sans-serif;font-size:26px;font-weight:900;color:#7050b8;">+${arrIncrementalTotal.toLocaleString('es-CL')} <span style="font-size:13px;font-weight:600;">UF/año</span> <span style="font-size:11px;font-weight:400;color:var(--muted);">si se cumplen los 3</span></div>
      </div>
      <!-- 3 tarjetas -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        ${_casosCard('caso1','Caso 1','#1a5ac4','Con SaaS & Sin seguro','Upsell — relación ya existe',caso1Rows.length,arrCaso1,'+UF/año','—')}
        ${_casosCard('caso2','Caso 2','#7050b8','Sin SaaS & Sin seguro','Bundle — seguro abre la puerta',caso2Rows.length,arrCaso2Corr+arrCaso2Saas,'+UF/año','Corredora + SaaS')}
        ${_casosCard('caso3','Caso 3','#0a9e72','Con SaaS & Con seguro','Base actual · ya generando',caso3Rows.length,arrCaso3,'UF/año','—')}
      </div>
      <!-- panel de detalle (se rellena al seleccionar) -->
      <div id="dash-caso-detail" style="margin-top:12px;"></div>
    </div>`;
}

// ── Helpers tarjetas de casos ──
function _casosCard(id,label,color,title,sub,n,arr,arrSuffix,saasNote){
  return `<div id="caso-card-${id}" onclick="selectDashCaso('${id}')" style="cursor:pointer;border:2px solid ${color}30;border-radius:14px;padding:1rem 1.1rem;background:var(--surface);transition:all .15s;user-select:none;" onmouseenter="this.style.borderColor='${color}80'" onmouseleave="if(!this.classList.contains('caso-sel'))this.style.borderColor='${color}30'">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:100px;background:${color}18;color:${color};">${label}</span>
      <span id="caso-check-${id}" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;border:2px solid ${color}40;font-size:11px;font-weight:700;color:${color};transition:all .15s;"></span>
    </div>
    <div style="font-size:13px;font-weight:700;color:var(--fg);margin-bottom:2px;">${title}</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">${sub}</div>
    <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:900;color:${color};line-height:1;">${n.toLocaleString('es-CL')}</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:6px;">comunidades</div>
    <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:${color};">${arrSuffix.replace('UF/año','').trim()}${arr.toLocaleString('es-CL')} <span style="font-size:11px;font-weight:500;">UF/año</span></div>
    <div style="font-size:10px;color:var(--muted);">${saasNote}</div>
  </div>`;
}
let _dashSelectedCasos=new Set();
function selectDashCaso(id){
  // toggle en el Set
  if(_dashSelectedCasos.has(id)){_dashSelectedCasos.delete(id);}else{_dashSelectedCasos.add(id);}
  // actualizar estilos de tarjetas
  const COLORS={'caso3':'#0a9e72','caso1':'#1a5ac4','caso2':'#7050b8'};
  ['caso3','caso1','caso2'].forEach(c=>{
    const card=document.getElementById('caso-card-'+c);
    const chk=document.getElementById('caso-check-'+c);
    const color=COLORS[c];
    if(!card)return;
    if(_dashSelectedCasos.has(c)){
      card.style.borderColor=color;card.style.background=color+'0d';
      card.classList.add('caso-sel');
      if(chk){chk.style.background=color;chk.style.borderColor=color;chk.style.color='#fff';chk.textContent='✓';}
    } else {
      card.style.borderColor=color+'30';card.style.background='var(--surface)';
      card.classList.remove('caso-sel');
      if(chk){chk.style.background='transparent';chk.style.borderColor=color+'40';chk.style.color=color;chk.textContent='';}
    }
  });
  // panel detalle
  const det=document.getElementById('dash-caso-detail');
  if(!det)return;
  if(_dashSelectedCasos.size===0){det.innerHTML='';return;}
  const LABELS={'caso3':'Caso 3','caso1':'Caso 1','caso2':'Caso 2'};
  const PERFILES={'caso3':'Con SaaS & Con seguro','caso1':'Con SaaS & Sin seguro','caso2':'Sin SaaS & Sin seguro'};
  const churnPct=(bbddChurn*100).toFixed(0)+'%';
  const order=['caso3','caso1','caso2'];
  if(!window._dashCasos){det.innerHTML='';return;}
  let totalComs=0,totalArrCorr=0,totalArrSaas=0;
  const selRows=order.filter(c=>_dashSelectedCasos.has(c)&&window._dashCasos[c]).map(c=>{
    const d=window._dashCasos[c];
    totalComs+=d.rows.length;totalArrCorr+=d.arrCorr;totalArrSaas+=d.arrSaas||0;
    return{id:c,d,color:COLORS[c],label:LABELS[c],perfil:PERFILES[c]};
  });
  const totalHolding=totalArrCorr+totalArrSaas;
  const isMulti=selRows.length>1;
  det.innerHTML=`
    <div style="border:1px solid var(--border,#e0e0e0);border-radius:14px;padding:1.1rem 1.4rem;background:var(--surface);">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;color:var(--fg);">${isMulti?'Resumen de casos seleccionados':PERFILES[selRows[0].id]}</div>
        ${isMulti?`<div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:900;color:#7050b8;">+${totalHolding.toLocaleString('es-CL')} <span style="font-size:11px;font-weight:500;">UF/año</span> <span style="font-size:10px;font-weight:400;color:var(--muted);">combinado</span></div>`:''}
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;min-width:520px;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:2px solid var(--border,#e0e0e0);">
              <th style="text-align:left;padding:7px 10px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">Caso</th>
              <th style="text-align:left;padding:7px 10px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">Perfil</th>
              <th style="text-align:right;padding:7px 10px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">Comunidades</th>
              <th style="text-align:right;padding:7px 10px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">ARR Corredora · churn ${churnPct}</th>
              <th style="text-align:right;padding:7px 10px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">ARR SaaS nuevos</th>
              <th style="text-align:right;padding:7px 10px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">Total holding</th>
            </tr>
          </thead>
          <tbody>
            ${selRows.map(({id,d,color,label,perfil})=>{
              const arrSaas=d.arrSaas||0;
              const total=d.arrCorr+arrSaas;
              return `<tr style="border-bottom:1px solid var(--border,#e8e8e8);">
                <td style="padding:9px 10px;"><span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:100px;background:${color}18;color:${color};">${label}</span></td>
                <td style="padding:9px 10px;font-size:12px;color:var(--fg);">${perfil}</td>
                <td style="padding:9px 10px;text-align:right;font-family:'Syne',sans-serif;font-weight:700;color:${color};">${d.rows.length.toLocaleString('es-CL')}</td>
                <td style="padding:9px 10px;text-align:right;font-family:'Syne',sans-serif;font-weight:700;color:${color};">${id==='caso3'?'':'+'}${d.arrCorr.toLocaleString('es-CL')} <span style="font-size:10px;font-weight:400;">UF/año</span></td>
                <td style="padding:9px 10px;text-align:right;font-family:'Syne',sans-serif;font-weight:700;color:${color};">${arrSaas>0?'+'+arrSaas.toLocaleString('es-CL')+' <span style="font-size:10px;font-weight:400;">UF/año</span>':'—'}</td>
                <td style="padding:9px 10px;text-align:right;font-family:'Syne',sans-serif;font-weight:700;color:${color};">${id==='caso3'?'':'+'}${total.toLocaleString('es-CL')} <span style="font-size:10px;font-weight:400;">UF/año</span></td>
              </tr>`;
            }).join('')}
          </tbody>
          ${isMulti?`<tfoot>
            <tr style="border-top:2px solid #7050b8;background:#7050b808;">
              <td colspan="2" style="padding:9px 10px;font-size:12px;font-weight:700;color:#7050b8;">Incremento total</td>
              <td style="padding:9px 10px;text-align:right;font-family:'Syne',sans-serif;font-weight:700;color:#7050b8;">${totalComs.toLocaleString('es-CL')}</td>
              <td style="padding:9px 10px;text-align:right;font-family:'Syne',sans-serif;font-weight:700;color:#7050b8;">+${totalArrCorr.toLocaleString('es-CL')} <span style="font-size:10px;font-weight:400;">UF/año</span></td>
              <td style="padding:9px 10px;text-align:right;font-family:'Syne',sans-serif;font-weight:700;color:#7050b8;">${totalArrSaas>0?'+'+totalArrSaas.toLocaleString('es-CL')+' <span style="font-size:10px;font-weight:400;">UF/año</span>':'—'}</td>
              <td style="padding:9px 10px;text-align:right;font-family:'Syne',sans-serif;font-weight:700;color:#7050b8;">+${totalHolding.toLocaleString('es-CL')} <span style="font-size:10px;font-weight:400;">UF/año</span></td>
            </tr>
          </tfoot>`:''}
        </table>
      </div>
      ${!isMulti?`<div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;"><div style="font-size:12px;color:var(--muted);">${selRows[0].d.desc}</div><button onclick="setBBDDEstadoFilter('${selRows[0].d.filtro}');setView('bbdd')" style="padding:7px 14px;background:${selRows[0].color};color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;">Ver comunidades →</button></div>`:''}
    </div>`;
}

function renderBBDD(){
  if(bbddComunidades.length===0)return;
  document.getElementById('bbdd-empty').style.display='none';
  document.getElementById('bbdd-table-section').style.display='block';
  const com=parseFloat(document.getElementById('bbdd-comision').value)/100;
  const notes=getCNNotes();
  let rows=bbddComunidades.map(c=>{
    const cobr=c.cob||bbddCob,tasa=cobr==='is'?bbddTasaIS:bbddTasaI;
    const mrrSeg=c.ma>0?c.ma*tasa*com/12:0;
    const saasCost=c.tieneSaas?c.precioLista:bbddDefaultIntercompany;
    const netGain=mrrSeg-saasCost;
    const diferencial=saasCost>0?mrrSeg/saasCost:0;
    const noteKey='bbdd_'+(c.rut&&c.rut!=='—'?c.rut:c.nombre);
    return{...c,cobr,mrrSeg,saasCost,netGain,diferencial,noteKey};
  });
  // ── Disparar dashboard (pasar allRows ya computadas para evitar doble cómputo) ──
  renderDashboard(rows);
  // ── Totales por estado (universo completo, sin filtro) ──
  const nActivo=bbddComunidades.filter(r=>r.estadoSeguro==='activo').length;
  const nInactivo=bbddComunidades.filter(r=>r.estadoSeguro==='inactivo').length;
  const nNunca=bbddComunidades.filter(r=>r.estadoSeguro==='nunca').length;
  // Aplicar filtro Estado Seguro / Escenario
  if(bbddFilterEstado==='activo')    rows=rows.filter(r=>r.estadoSeguro==='activo');
  else if(bbddFilterEstado==='inactivo') rows=rows.filter(r=>r.estadoSeguro==='inactivo');
  else if(bbddFilterEstado==='nunca')    rows=rows.filter(r=>r.estadoSeguro==='nunca');
  else if(bbddFilterEstado==='caso3')    rows=rows.filter(r=>r.tieneSaas&&r.estadoSeguro==='activo');
  else if(bbddFilterEstado==='caso1')    rows=rows.filter(r=>r.tieneSaas&&r.estadoSeguro!=='activo');
  else if(bbddFilterEstado==='caso2')    rows=rows.filter(r=>!r.tieneSaas&&r.estadoSeguro!=='activo');
  else if(bbddFilterEstado==='califica') rows=rows.filter(r=>r.saasCost>0&&(r.mrrSeg/r.saasCost)>=umbralDiferencial);
  // Aplicar búsqueda por nombre / RUT
  if(bbddSearch){
    const q=norm(bbddSearch);
    const qDigits=bbddSearch.replace(/[^0-9]/g,'');
    rows=rows.filter(r=>{
      if(norm(r.nombre).includes(q))return true;
      if(qDigits&&String(r.rut).replace(/[^0-9]/g,'').includes(qDigits))return true;
      return false;
    });
  }
  let totalSeg=0,totalSaaS=0,totalNet=0,totalDif=0;
  rows.forEach(r=>{totalSeg+=r.mrrSeg;totalSaaS+=r.saasCost;totalNet+=r.netGain;totalDif+=r.diferencial;});
  const avgDif=rows.length>0?totalDif/rows.length:0;
  const arrSeg=totalSeg*12;
  const arrNetChurn=totalNet*12*(1-bbddChurn);
  const churnPct=(bbddChurn*100).toFixed(1);

  // ── Métricas resumen ──
  document.getElementById('bbdd-mrr-seg').textContent=fmtUF(totalSeg)+' UF/mes';
  document.getElementById('bbdd-arr-seg').textContent=fmtUF(arrSeg)+' UF/año';
  document.getElementById('bbdd-saas-cost').textContent=fmtUF(totalSaaS)+' UF/mes';

  const netEl=document.getElementById('bbdd-net-rem');
  netEl.textContent=(totalNet>=0?'+':'')+fmtUF(totalNet)+' UF/mes';
  netEl.style.color=totalNet>=0?'#0a9e72':'#d63228';
  const netCurr=document.getElementById('bbdd-net-currencies');
  if(netCurr)netCurr.innerHTML=`<span class="metric-currency-tag">${fmtCLP(totalNet)}/mes</span><span class="metric-currency-tag">${fmtUSD(totalNet)}/mes</span>`;

  const arrEl=document.getElementById('bbdd-arr-net');
  arrEl.textContent=(arrNetChurn>=0?'+':'')+fmtUF(arrNetChurn)+' UF/año';
  arrEl.style.color=arrNetChurn>=0?'#0a9e72':'#d63228';
  const arrCurr=document.getElementById('bbdd-arr-currencies');
  if(arrCurr)arrCurr.innerHTML=`<span class="metric-currency-tag">${fmtCLP(arrNetChurn)}/año</span><span class="metric-currency-tag">${fmtUSD(arrNetChurn)}/año</span>`;
  const arrSub=document.getElementById('bbdd-arr-net-sub');
  if(arrSub)arrSub.textContent=bbddChurn>0?`Con churn ${churnPct}% aplicado`:'Potencial bruto (churn 0%)';

  // ── Insight block ──
  const insightEl=document.getElementById('bbdd-insight');
  const igEl=document.getElementById('insight-grid');
  if(insightEl&&igEl){
    insightEl.style.display='block';
    const viable=rows.filter(r=>r.netGain>=0).length;
    const pctViable=rows.length>0?Math.round(viable/rows.length*100):0;
    const pctSaasCubierto=totalSeg>0?Math.round(totalSaaS/totalSeg*100):0;
    const margenNeto=totalSeg>0?Math.round(totalNet/totalSeg*100):0;
    igEl.innerHTML=
      `<div class="insight-card" style="border-left-color:#0a9e72;">
        <div class="insight-card-label">Comunidades viables</div>
        <div class="insight-card-val" style="color:#0a9e72;">${viable} <span style="font-size:13px;font-weight:500;color:var(--muted);">de ${rows.length}</span></div>
        <div class="insight-card-sub">${pctViable}% cierran con MRR positivo</div>
      </div>
      <div class="insight-card" style="border-left-color:#1a5ac4;">
        <div class="insight-card-label">Cobertura del modelo</div>
        <div class="insight-card-val" style="color:#1a5ac4;">${pctSaasCubierto}%</div>
        <div class="insight-card-sub">Del MRR de seguros va a cubrir SaaS intercompany</div>
      </div>
      <div class="insight-card" style="border-left-color:#7050b8;">
        <div class="insight-card-label">Margen neto estimado</div>
        <div class="insight-card-val" style="color:#7050b8;">${margenNeto}%</div>
        <div class="insight-card-sub">Sobre prima total generada</div>
      </div>
      <div class="insight-card" style="border-left-color:#0a9e72;grid-column:span 1;">
        <div class="insight-card-label">Estado seguro — cartera total</div>
        <div style="display:flex;gap:10px;margin:6px 0;flex-wrap:wrap;">
          <span><span class="estado-badge estado-activo">activo</span> <strong style="font-family:'Syne',sans-serif;font-size:16px;">${nActivo}</strong></span>
          <span><span class="estado-badge estado-inactivo">inactivo</span> <strong style="font-family:'Syne',sans-serif;font-size:16px;">${nInactivo}</strong></span>
          <span><span class="estado-badge estado-nunca">nunca</span> <strong style="font-family:'Syne',sans-serif;font-size:16px;">${nNunca}</strong></span>
        </div>
        <div class="insight-card-sub">${nActivo} ya son clientes de seguro — el resto es pipeline</div>
      </div>`;
  }

  // ── Tabla (string building para performance con ~8k filas) ──
  const filterLabels={'all':'','activo':' (activo)','inactivo':' (inactivo)','nunca':' (nunca)','caso1':' (Caso 1 — Con SaaS, sin seguro)','caso2':' (Caso 2 — Sin SaaS, sin seguro)','caso3':' (Caso 3 — Con SaaS, activo)','califica':' (✅ Califica — diferencial ≥ '+umbralDiferencial.toLocaleString('es-CL',{minimumFractionDigits:1})+'x)'};
  const filterLabel=(filterLabels[bbddFilterEstado]||'')+( bbddSearch?` · "${bbddSearch}"`:'');
  bbddFilteredRows=rows;
  const counter=document.getElementById('bbdd-counter');if(counter){counter.style.display='block';counter.innerHTML=`<span style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--primary);">${rows.length.toLocaleString('es-CL')}</span> <span style="font-size:13px;font-weight:500;color:var(--muted);">comunidad${rows.length!==1?'es':''}</span>`;}
  const expBtn=document.getElementById('bbdd-export-btn');if(expBtn)expBtn.style.display=rows.length?'flex':'none';
  let html='';
  rows.forEach(c=>{
    let sl,sc;
    if(c.netGain>=1){sl='Alta';sc='#0a9e72';}else if(c.netGain>=0){sl='Media';sc='#BA7517';}else{sl='Baja';sc='#d63228';}
    const difColor=c.diferencial>=umbralDiferencial?'#0a9e72':c.diferencial>=1?'#BA7517':'#d63228';
    const noteVal=(notes[c.noteKey]||'').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
    const nk=c.noteKey.replace(/'/g,"\\'");
    html+=`<tr>
      <td>${esc(c.nombre)}</td>
      <td style="font-size:11px;color:var(--muted);">${esc(c.rut||'—')}</td>
      <td><span class="estado-badge estado-${c.estadoSeguro||'nunca'}">${c.estadoSeguro||'nunca'}</span></td>
      <td><span class="cn-badge ${c.cobr==='is'?'cn-badge-is':'cn-badge-i'}">${c.cobr==='is'?'Inc.+Sismo':'Incendio'}</span></td>
      <td>${c.ma>0?c.ma.toLocaleString('es-CL')+' UF':'—'}</td>
      <td style="color:#1a5ac4;font-weight:500;">${c.mrrSeg>0?fmtUF(c.mrrSeg)+' UF/mes':'—'}</td>
      <td style="color:var(--muted);">${c.precioLista>0?fmtUF(c.precioLista)+' UF/mes':'—'}</td>
      <td style="color:#d63228;">−${fmtUF(c.saasCost)} UF/mes <span style="font-size:9px;color:var(--muted);">${c.tieneSaas?'(= lista)':'(sin SaaS)'}</span></td>
      <td style="color:${difColor};font-weight:500;">${c.diferencial.toFixed(2)}x</td>
      <td style="font-weight:500;color:${c.netGain>=0?'#0a9e72':'#d63228'};">${(c.netGain>=0?'+':'')+fmtUF(c.netGain)} UF/mes</td>
      <td><span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:100px;background:${sc}18;color:${sc}">${sl}</span></td>
      <td><div class="cn-note-cell"><span class="cn-note-preview${noteVal?'':' empty'}" onclick="toggleCNNote(this,'${nk}')">${noteVal||'+'}</span><textarea class="cn-note-input" style="display:none;" onblur="saveCNNoteEl(this,'${nk}')" rows="2">${noteVal}</textarea></div></td>
    </tr>`;
  });
  // Fila total
  html+=`<tr style="background:var(--surface2);">
    <td colspan="4"><strong>TOTAL — ${rows.length} comunidades${filterLabel}</strong></td>
    <td></td>
    <td style="color:#1a5ac4;font-weight:700;">${fmtUF(totalSeg)} UF/mes</td>
    <td></td>
    <td style="color:#d63228;font-weight:700;">−${fmtUF(totalSaaS)} UF/mes</td>
    <td style="color:${avgDif>=2?'#0a9e72':avgDif>=1?'#BA7517':'#d63228'};font-weight:700;">${avgDif.toFixed(2)}x <span style="font-size:10px;font-weight:400;color:var(--muted);">prom.</span></td>
    <td style="color:${totalNet>=0?'#0a9e72':'#d63228'};font-weight:700;">${(totalNet>=0?'+':'')+fmtUF(totalNet)} UF/mes</td>
    <td></td><td></td>
  </tr>`;
  document.getElementById('bbdd-tbody').innerHTML=html;

  const pct=totalSeg>0?Math.round((totalSaaS/totalSeg)*100):0;
  document.getElementById('bbdd-nota').innerHTML=`El SaaS representa el <strong>${pct}%</strong> del MRR de seguros — el modelo <strong style="color:${totalNet>=0?'#0a9e72':'#d63228'}">${totalNet>=0?'cierra positivo':'no cierra aún'}</strong>. Remanente mensual: <strong style="color:${totalNet>=0?'#0a9e72':'#d63228'}">${(totalNet>=0?'+':'')+fmtUF(totalNet)} UF/mes</strong> · ARR neto con churn ${churnPct}%: <strong style="color:${arrNetChurn>=0?'#0a9e72':'#d63228'}">${(arrNetChurn>=0?'+':'')+fmtUF(arrNetChurn)} UF/año</strong> · <strong>${fmtCLP(arrNetChurn)}/año</strong> · <strong>${fmtUSD(arrNetChurn)}/año</strong>.`;
  renderAgenteBBDD();
}

recalc();

// ── Tabla de Rentabilidad ──
let tablaSelectedThreshold=2.0;
let tablaSubExpanded=false;
const TABLA_THRESHOLDS=[1,1.5,2,3,3.5,4,4.5,5];
const TABLA_SUBTIERS=[2.1,2.2,2.3,2.4,2.5,2.6,2.7,2.8,2.9];

function _tablaRowHTML(t,qualifying,mrrTotal,remTotal,isSelected,isSub){
  const arrNeto=remTotal*12;
  const indent=isSub?'padding-left:28px;color:var(--muted);font-size:13px;':'';
  const prefix=isSub?'<span style="opacity:.4;margin-right:4px;">└</span>':'';
  return `<td style="${indent}">${prefix}${t}x</td>`+
    `<td style="text-align:right;">${qualifying.length.toLocaleString('es-CL')}</td>`+
    `<td style="text-align:right;">UF ${mrrTotal.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>`+
    `<td style="text-align:right;">UF ${remTotal.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>`+
    `<td style="text-align:right;">UF ${arrNeto.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>`;
}

function renderTabla(){
  if(!bbddComunidades||bbddComunidades.length===0){
    document.getElementById('tabla-empty').style.display='block';
    document.getElementById('tabla-content').style.display='none';
    return;
  }
  document.getElementById('tabla-empty').style.display='none';
  document.getElementById('tabla-content').style.display='block';
  const com=parseFloat(document.getElementById('bbdd-comision').value)/100;
  const allRows=bbddComunidades.map(r=>{
    const cobr=r.cob||bbddCob;
    const tasa=cobr==='is'?bbddTasaIS:bbddTasaI;
    const mrrSeg=r.ma>0?r.ma*tasa*com/12:0;
    const saasCost=r.tieneSaas?r.precioLista:bbddDefaultIntercompany;
    const diferencial=saasCost>0?mrrSeg/saasCost:0;
    const remanente=mrrSeg-saasCost;
    return{...r,cobr,mrrSeg,saasCost,saasIntercompany:bbddDefaultIntercompany,diferencial,remanente};
  });
  const tbodyS=document.getElementById('tabla-summary-tbody');
  tbodyS.innerHTML='';
  TABLA_THRESHOLDS.forEach(t=>{
    const qualifying=allRows.filter(r=>r.diferencial>=t);
    const mrrTotal=qualifying.reduce((s,r)=>s+r.mrrSeg,0);
    const remTotal=qualifying.reduce((s,r)=>s+r.remanente,0);
    const isSelected=t===tablaSelectedThreshold;
    const tr=document.createElement('tr');
    tr.style.cssText='cursor:pointer;'+(isSelected?'background:var(--primary-light,#e8f5ef);font-weight:700;':'');
    tr.dataset.thresh=t;
    tr.onclick=(()=>{const _t=t;return()=>selectTablaThreshold(_t,allRows);})();
    // Fila 2x: agrega botón expandir
    if(t===2){
      const expandIcon=tablaSubExpanded?'▾':'▸';
      tr.innerHTML=`<td style="white-space:nowrap;">${t}x <button onclick="event.stopPropagation();toggleTablaSubtiers(this,allRowsRef)" style="background:none;border:none;padding:1px 4px;font-size:13px;cursor:pointer;color:var(--muted);margin-left:4px;line-height:1;">${expandIcon}</button></td>`+
        `<td style="text-align:right;">${qualifying.length.toLocaleString('es-CL')}</td>`+
        `<td style="text-align:right;">UF ${mrrTotal.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>`+
        `<td style="text-align:right;">UF ${remTotal.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>`+
        `<td style="text-align:right;">UF ${(remTotal*12).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>`;
      // Fix: allRowsRef no disponible en onclick inline — usamos closure
      tr.querySelector('button').onclick=function(e){e.stopPropagation();toggleTablaSubtiers(allRows);};
    } else {
      tr.innerHTML=_tablaRowHTML(t,qualifying,mrrTotal,remTotal,isSelected,false);
    }
    tbodyS.appendChild(tr);
    // Sub-filas 2.1–2.9 después de la fila 2x
    if(t===2){
      TABLA_SUBTIERS.forEach(st=>{
        const sq=allRows.filter(r=>r.diferencial>=st);
        const sm=sq.reduce((s,r)=>s+r.mrrSeg,0);
        const sr=sq.reduce((s,r)=>s+r.remanente,0);
        const isSel=st===tablaSelectedThreshold;
        const subTr=document.createElement('tr');
        subTr.dataset.subtier=st;
        subTr.style.cssText=(tablaSubExpanded?'':'display:none;')+'cursor:pointer;'+(isSel?'background:var(--primary-light,#e8f5ef);font-weight:700;':'background:#f9fafb;');
        subTr.onclick=(()=>{const _t=st;return()=>selectTablaThreshold(_t,allRows);})();
        subTr.innerHTML=_tablaRowHTML(st,sq,sm,sr,isSel,true);
        tbodyS.appendChild(subTr);
      });
    }
  });
  renderTablaDetail(allRows);
}

function toggleTablaSubtiers(allRows){
  tablaSubExpanded=!tablaSubExpanded;
  const tbodyS=document.getElementById('tabla-summary-tbody');
  // Actualiza icono en botón
  const btn=tbodyS.querySelector('button');
  if(btn)btn.textContent=tablaSubExpanded?'▾':'▸';
  // Muestra/oculta sub-filas
  Array.from(tbodyS.querySelectorAll('tr[data-subtier]')).forEach(tr=>{
    tr.style.display=tablaSubExpanded?'':'none';
  });
}

function selectTablaThreshold(t,allRows){
  tablaSelectedThreshold=t;
  const tbodyS=document.getElementById('tabla-summary-tbody');
  const allThresholds=[...TABLA_THRESHOLDS,...TABLA_SUBTIERS];
  Array.from(tbodyS.rows).forEach(tr=>{
    const th=parseFloat(tr.dataset.thresh||tr.dataset.subtier);
    const sel=th===t;
    tr.style.background=sel?'var(--primary-light,#e8f5ef)':(tr.dataset.subtier?'#f9fafb':'');
    tr.style.fontWeight=sel?'700':'';
  });
  renderTablaDetail(allRows);
}

function renderTablaDetail(allRows){
  const rows=allRows.filter(r=>r.diferencial>=tablaSelectedThreshold);
  document.getElementById('tabla-detail-title').textContent=
    `Comunidades con rentabilidad ≥ ${tablaSelectedThreshold}x (${rows.length.toLocaleString('es-CL')})`;
  const exportBtn=document.getElementById('tabla-export-btn');
  exportBtn.style.display=rows.length>0?'inline-flex':'none';
  window._tablaDetailRows=rows;
  const tbody=document.getElementById('tabla-detail-tbody');
  tbody.innerHTML='';
  rows.forEach(r=>{
    const difColor=r.diferencial>=tablaSelectedThreshold?'#0a9e72':r.diferencial>=1?'#BA7517':'#d63228';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${esc(r.nombre||r.comunidad||'')}</td>`+
      `<td style="font-size:11px;color:var(--muted);">${esc(r.rut||'—')}</td>`+
      `<td><span class="estado-badge estado-${r.estadoSeguro||'nunca'}">${r.estadoSeguro||'nunca'}</span></td>`+
      `<td><span class="cn-badge ${r.cobr==='is'?'cn-badge-is':'cn-badge-i'}">${r.cobr==='is'?'Inc.+Sismo':'Incendio'}</span></td>`+
      `<td style="text-align:right;">${r.ma>0?r.ma.toLocaleString('es-CL')+' UF':'—'}</td>`+
      `<td style="text-align:right;color:#1a5ac4;font-weight:500;">${r.mrrSeg>0?fmtUF(r.mrrSeg)+' UF':'—'}</td>`+
      `<td style="text-align:center;"><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;background:${r.tieneSaas?'#0a9e7218':'#d6322818'};color:${r.tieneSaas?'#0a9e72':'#d63228'};">${r.tieneSaas?'Sí':'No'}</span></td>`+
      `<td style="text-align:right;color:var(--muted);">${r.tieneSaas&&r.precioLista>0?fmtUF(r.precioLista)+' UF':'—'}</td>`+
      `<td style="text-align:right;">${r.saasIntercompany>0?fmtUF(r.saasIntercompany)+' UF':'—'}</td>`+
      `<td style="text-align:right;color:${difColor};font-weight:600;">${r.diferencial.toFixed(2)}x</td>`+
      `<td style="text-align:right;font-weight:500;color:${r.remanente>=0?'#0a9e72':'#d63228'};">${(r.remanente>=0?'+':'')+fmtUF(r.remanente)} UF</td>`;
    tbody.appendChild(tr);
  });
}

function exportTablaExcel(){
  const rows=window._tablaDetailRows||[];
  if(!rows.length)return;
  const wsData=[['Comunidad','RUT','Estado seguro','Cobertura','MA (UF)','MRR seguro (UF)','¿Tiene SaaS?','Precio lista SaaS (UF)','Precio intercompany (UF)','Ratio MRR/SaaS','Remanente corredora (UF)']];
  rows.forEach(r=>{
    wsData.push([
      r.nombre||r.comunidad||'',
      r.rut||'',
      r.estadoSeguro||r.estado||'',
      r.cobr==='is'?'Inc.+Sismo':'Incendio',
      r.ma||0,
      +r.mrrSeg.toFixed(2),
      r.tieneSaas?'Sí':'No',
      r.tieneSaas&&r.precioLista>0?+r.precioLista.toFixed(2):'',
      +r.saasIntercompany.toFixed(2),
      +r.diferencial.toFixed(4),
      +r.remanente.toFixed(2)
    ]);
  });
  const ws=XLSX.utils.aoa_to_sheet(wsData);
  const wb_exp=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb_exp,'Tabla',ws);
  XLSX.writeFile(wb_exp,`tabla_rentabilidad_${tablaSelectedThreshold}x.xlsx`);
}

// ── Carga BBDD por defecto (Proyección MA — datos embebidos) ──
function loadDefaultBBDD(){
  if(typeof XLSX==='undefined'){
    // XLSX aún cargando — reintenta
    setTimeout(loadDefaultBBDD,400);return;
  }
  if(typeof BBDD_DEFAULT_B64==='undefined'){
    console.warn('bbdd_data.js no cargado');return;
  }
  const btn=document.getElementById('btn-load-default');
  if(btn){btn.textContent='⏳ Cargando…';btn.disabled=true;}
  try{
    // decodificar base64 → ArrayBuffer
    const bin=atob(BBDD_DEFAULT_B64);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    setBBDDFilePill('Proyección MAxlsx.xlsx');
    parseBBDDExcel(bytes.buffer);
    if(btn){btn.textContent='✅ BBDD cargada';setTimeout(()=>{btn.textContent='⚡ Cargar BBDD CF';btn.disabled=false;},1800);}
  }catch(e){
    console.error('Error cargando BBDD:',e);
    if(btn){btn.textContent='⚡ Cargar BBDD CF';btn.disabled=false;}
  }
}
window.addEventListener('load',function(){
  setTimeout(loadDefaultBBDD,400);
});
