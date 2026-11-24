import {sb} from './supa.js';
import {$,qsa,safe,money,icon,fmtDate,today,toast,confirmAction,setBusy,downloadCsv} from './utils.js';
import {state} from './state.js';
import {RECEIPT_BUCKET,HISTORY_LIMIT} from './config.js';

let inflight=null;

// One shared fetch feeds the dashboard, the history page and the stats (the original fetched the same list three times).
export function loadReceipts({force=false}={}){
  if(!state.user) return Promise.resolve();
  if(inflight) return inflight;
  if(!force&&state.receiptsLoaded&&Date.now()-state.receiptsAt<30000) return Promise.resolve();
  inflight=doLoad().finally(()=>{inflight=null});
  return inflight;
}

async function doLoad(){
  const uid=state.user.id;
  if(!state.receiptsLoaded) renderLoading();
  const [main,rep,owe]=await Promise.all([
    sb.from('receipts').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(HISTORY_LIMIT),
    // Light copy so sales figures and the report cover all receipts, not just the latest few.
    sb.from('receipts').select('receipt_date,total,doc_type,payment_status,amount_paid').eq('user_id',uid).order('receipt_date',{ascending:false}).limit(5000),
    // Everything that still has a balance (for the Money page).
    sb.from('receipts').select('*').eq('user_id',uid).neq('payment_status','paid').order('created_at',{ascending:false}).limit(500)
  ]);
  if(state.user?.id!==uid) return;   // signed out or switched account while loading
  const {data,error}=main;
  if(error){renderError(error.message);return}
  state.report=rep.error?null:(rep.data||[]);
  state.owing=owe.error?[]:(owe.data||[]);
  state.receipts=data||[];
  state.receiptsLoaded=true;
  state.receiptsAt=Date.now();
  renderAll();
}

/* ---------- Rendering ---------- */
const balanceOf=r=>Math.max(0,(Number(r.total)||0)-(r.payment_status==='unpaid'?0:(Number(r.amount_paid)||0)));
export function badgesHTML(r){
  let h='';
  if(r.doc_type==='invoice') h+='<span class="pill">Invoice</span>';
  else if(r.doc_type==='quote') h+='<span class="pill">Quotation</span>';
  if(r.payment_status==='part') h+='<span class="pill warn">Part paid</span>';
  else if(r.payment_status==='unpaid') h+='<span class="pill bad">Not paid</span>';
  return h?`<span class="badges">${h}</span>`:'';
}
function rowHTML(r,full){
  const id=safe(r.id),num=safe(r.receipt_number);
  const btn=(act,ico,label,cls='')=>`<button class="icon-btn ${cls}" type="button" data-act="${act}" title="${label}" aria-label="${label}, receipt ${num}">${icon(ico)}</button>`;
  return `<article class="rrow" data-id="${id}">`+
    `<div class="rrow-main"><b>${num}</b><span class="who">${safe(r.customer_name||'Customer')}</span><span>${safe(fmtDate(r.receipt_date))}</span>${badgesHTML(r)}</div>`+
    `<div class="rrow-total">₦${money(r.total)}${r.payment_status&&r.payment_status!=='paid'?`<small class="owe-note">Balance ₦${money(balanceOf(r))}</small>`:''}</div>`+
    `<div class="rrow-actions">${btn('open','pencil','Open and edit')}${full?btn('duplicate','copy','Make a copy'):''}${btn('view','image','View image')}${full?btn('download','download','Download PNG')+btn('delete','trash','Delete','danger'):''}</div>`+
    `</article>`;
}

const emptyHTML=`<div class="empty">${icon('file-text')}<b>No receipts yet</b><span>Receipts you save will appear here.</span><a class="btn btn-primary" href="/create-receipt" data-route="/create-receipt">Create your first receipt</a></div>`;

function renderLoading(){
  $('history').innerHTML='<div class="spinner" role="status" aria-label="Loading receipts"></div>';
  $('dashboardHistoryList').innerHTML='<div class="spinner" role="status" aria-label="Loading receipts"></div>';
}

function renderError(message){
  const html=`<div class="empty">${icon('alert')}<b>Could not load receipts</b><span>${safe(message)}</span></div>`;
  $('history').innerHTML=html;
  $('dashboardHistoryList').innerHTML=html;
}

export function renderAll(){renderDashboard();renderHistory();renderStats();renderReport();document.dispatchEvent(new Event('receipts:updated'))}

function renderDashboard(){
  const list=state.receipts.slice(0,5);
  $('dashboardHistoryList').innerHTML=list.length?list.map(r=>rowHTML(r,false)).join(''):emptyHTML;
}

export function renderHistory(){
  const el=$('history');
  if(!state.receiptsLoaded) return;
  if(!state.receipts.length){el.innerHTML=emptyHTML;return}
  const q=$('receiptSearch').value.trim().toLowerCase();
  const list=state.receipts.filter(r=>!q||String(r.receipt_number||'').toLowerCase().includes(q)||String(r.customer_name||'').toLowerCase().includes(q));
  el.innerHTML=list.length?list.map(r=>rowHTML(r,true)).join(''):`<div class="empty">${icon('search')}<b>No matching receipts</b><span>Try a different receipt number or customer name.</span></div>`;
}

// All receipts' date + total when available, otherwise the latest receipts that are already loaded.
// Quotations are price offers, not sales.
export const salesRows=()=>(state.report||state.receipts).filter(r=>r.doc_type!=='quote');
const sumOf=rows=>rows.reduce((s,r)=>s+(Number(r.total)||0),0);

let reportRange=7;
const pad2=n=>String(n).padStart(2,'0');
const dayKey=d=>d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function renderReport(){
  const chart=$('reportChart');
  if(!chart||!state.receiptsLoaded) return;
  const rows=salesRows(),now=new Date(),buckets=[];
  if(reportRange===12){
    for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);buckets.push({key:d.getFullYear()+'-'+pad2(d.getMonth()+1),label:MONTHS[d.getMonth()],full:MONTHS[d.getMonth()]+' '+d.getFullYear(),total:0,count:0})}
  }else{
    for(let i=reportRange-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);buckets.push({key:dayKey(d),label:reportRange===7?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]:String(d.getDate()),full:d.getDate()+' '+MONTHS[d.getMonth()],total:0,count:0})}
  }
  const map=new Map(buckets.map(b=>[b.key,b]));
  rows.forEach(r=>{const k=String(r.receipt_date||'').slice(0,reportRange===12?7:10),b=map.get(k);if(b){b.total+=Number(r.total)||0;b.count++}});
  const max=Math.max(1,...buckets.map(b=>b.total));
  const total=buckets.reduce((s,b)=>s+b.total,0),count=buckets.reduce((s,b)=>s+b.count,0);
  $('reportSum').innerHTML=count?`<b>₦${money(total)}</b> from ${count} receipt${count===1?'':'s'} in the last ${reportRange===12?'12 months':reportRange+' days'}.`:`No receipts in the last ${reportRange===12?'12 months':reportRange+' days'} yet.`;
  chart.setAttribute('aria-label',reportRange===12?'Sales per month':'Sales per day');
  chart.dataset.range=String(reportRange);
  chart.innerHTML=buckets.map(b=>`<div class="rcol" title="${safe(b.full)}: ₦${money(b.total)} (${b.count})"><div class="rtrack"><span class="rbar" style="height:${Math.max(b.total?3:0,Math.round(b.total/max*100))}%"></span></div><span class="rlab">${safe(b.label)}</span></div>`).join('');
}

export function renderStats(){
  if(!state.receiptsLoaded) return;
  const list=salesRows(),capped=!state.report&&list.length>=HISTORY_LIMIT;
  const total=list.reduce((s,r)=>s+(Number(r.total)||0),0);
  const ym=today().slice(0,7);
  $('statCount').textContent=capped?HISTORY_LIMIT+'+':String(list.length);
  $('statTotal').textContent='₦'+money(total);
  $('statMonth').textContent=String(list.filter(r=>String(r.receipt_date||'').startsWith(ym)).length);
  const sum=pre=>list.filter(r=>String(r.receipt_date||'').startsWith(pre)).reduce((s,r)=>s+(Number(r.total)||0),0);
  $('statSalesToday').textContent='₦'+money(sum(today()));
  $('statSalesMonth').textContent='₦'+money(sum(ym));
  $('statTotalNote').textContent=capped?`Sales total and monthly count are based on your latest ${HISTORY_LIMIT} receipts.`:'';
}

export function resetReceiptViews(){
  state.receipts=[];state.owing=[];state.report=null;state.receiptsLoaded=false;state.receiptsAt=0;
  ['statCount','statTotal','statMonth','statSalesToday','statSalesMonth'].forEach(id=>{$(id).textContent='—'});
  $('reportChart').innerHTML='';$('reportSum').textContent='';
  $('statTotalNote').textContent='';
  $('history').innerHTML='';$('dashboardHistoryList').innerHTML='';
}

/* ---------- Actions ---------- */
export async function openImage(path,download=false){
  if(!path){toast('This receipt was saved before image saving was enabled. Open it and save it again to store its image.','error');return}
  // Open the tab first (still inside the click) so phones do not block it as a pop-up after the await.
  const win=download?null:window.open('','_blank');
  const {data,error}=await sb.storage.from(RECEIPT_BUCKET).createSignedUrl(path,300,download?{download:true}:undefined);
  if(error){if(win)win.close();toast('Could not open receipt image: '+error.message,'error');return}
  if(download){
    const a=document.createElement('a');a.href=data.signedUrl;a.rel='noopener';
    document.body.appendChild(a);a.click();a.remove();
  }else if(win){win.opener=null;win.location.href=data.signedUrl}
  else window.open(data.signedUrl,'_blank','noopener');
}

async function deleteReceipt(r){
  const ok=await confirmAction({title:'Delete this receipt?',text:`Receipt ${r.receipt_number} will be permanently deleted from your account.`,okText:'Delete receipt',danger:true});
  if(!ok) return;
  const {error}=await sb.from('receipts').delete().eq('id',r.id).eq('user_id',state.user.id);
  if(error){toast('Could not delete receipt: '+error.message,'error');return}
  if(r.image_path){try{await sb.storage.from(RECEIPT_BUCKET).remove([r.image_path])}catch{/* best effort */}}
  toast('Receipt deleted.','success');
  await loadReceipts({force:true});
}

function bindList(el){
  el.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-act]');
    if(!btn) return;
    const row=btn.closest('[data-id]');
    const r=row&&state.receipts.find(x=>String(x.id)===row.dataset.id);
    if(!r) return;
    const act=btn.dataset.act;
    if(act==='duplicate') document.dispatchEvent(new CustomEvent('receipt:duplicate',{detail:r}));
    else if(act==='open') document.dispatchEvent(new CustomEvent('receipt:open',{detail:r}));
    else if(act==='view') openImage(r.image_path);
    else if(act==='download') openImage(r.image_path,true);
    else if(act==='delete') await deleteReceipt(r);
  });
}

async function exportCsv(){
  if(!state.user) return;
  const btn=$('receiptsCsv');
  setBusy(btn,true,'Preparing...');
  try{
    const {data,error}=await sb.from('receipts').select('receipt_number,doc_type,customer_name,receipt_date,total,payment_status,amount_paid,created_at,items').eq('user_id',state.user.id).order('receipt_date',{ascending:false}).limit(5000);
    if(error) throw error;
    const rows=(data||[]).map(r=>{
      const m=r.items&&typeof r.items==='object'&&!Array.isArray(r.items)?r.items:{};
      const lines=Array.isArray(m.lines)?m.lines:(Array.isArray(r.items)?r.items:[]);
      const itemsText=lines.map(x=>`${x.name} x${x.qty??x.quantity??1} @${x.price}`).join('; ');
      const total=Number(r.total)||0,status=r.payment_status||'paid',paid=status==='paid'?total:(Number(r.amount_paid)||0);
      return [r.receipt_number||'',r.doc_type||'receipt',r.receipt_date||'',r.customer_name||'',itemsText,m.payment||'',total,status,paid,Math.max(0,total-paid),r.created_at||''];
    });
    downloadCsv('machika-receipts-'+today()+'.csv',['Number','Type','Date','Customer','Items','Payment method','Total','Status','Amount paid','Balance','Created'],rows);
    toast(`Downloaded ${rows.length} receipt${rows.length===1?'':'s'}.`,'success');
  }catch(err){
    toast('Could not download your receipts: '+(err.message||err),'error');
  }finally{setBusy(btn,false)}
}

export function initReceipts(){
  $('receiptsCsv').addEventListener('click',exportCsv);
  bindList($('history'));
  bindList($('dashboardHistoryList'));
  $('receiptSearch').addEventListener('input',renderHistory);
  $('reportRange').addEventListener('click',e=>{
    const b=e.target.closest('[data-range]');if(!b) return;
    reportRange=Number(b.dataset.range);
    qsa('#reportRange [data-range]').forEach(x=>x.classList.toggle('is-active',x===b));
    renderReport();
  });
}
