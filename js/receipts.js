import {sb} from './supa.js';
import {$,safe,money,icon,fmtDate,today,toast,confirmAction} from './utils.js';
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
  const {data,error}=await sb.from('receipts').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(HISTORY_LIMIT);
  if(state.user?.id!==uid) return;   // signed out or switched account while loading
  if(error){renderError(error.message);return}
  state.receipts=data||[];
  state.receiptsLoaded=true;
  state.receiptsAt=Date.now();
  renderAll();
}

/* ---------- Rendering ---------- */
function rowHTML(r,full){
  const id=safe(r.id),num=safe(r.receipt_number);
  const btn=(act,ico,label,cls='')=>`<button class="icon-btn ${cls}" type="button" data-act="${act}" title="${label}" aria-label="${label}, receipt ${num}">${icon(ico)}</button>`;
  return `<article class="rrow" data-id="${id}">`+
    `<div class="rrow-main"><b>${num}</b><span class="who">${safe(r.customer_name||'Customer')}</span><span>${safe(fmtDate(r.receipt_date))}</span></div>`+
    `<div class="rrow-total">₦${money(r.total)}</div>`+
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

export function renderAll(){renderDashboard();renderHistory();renderStats()}

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

export function renderStats(){
  if(!state.receiptsLoaded) return;
  const list=state.receipts,capped=list.length>=HISTORY_LIMIT;
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
  state.receipts=[];state.receiptsLoaded=false;state.receiptsAt=0;
  ['statCount','statTotal','statMonth','statSalesToday','statSalesMonth'].forEach(id=>{$(id).textContent='—'});
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

export function initReceipts(){
  bindList($('history'));
  bindList($('dashboardHistoryList'));
  $('receiptSearch').addEventListener('input',renderHistory);
}
