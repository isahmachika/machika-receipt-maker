import {sb} from './supa.js';
import {$,qsa,safe,money,icon,toast,setBusy,askNumber} from './utils.js';
import {state} from './state.js';

// Saved items (name + usual price) and saved customers, kept per account.
// If the two Supabase tables are not created yet, everything here quietly switches off and receipts still work.
const cat={items:[],customers:[],ok:true,err:''};
export const LOW_STOCK=5;   // an item with this many (or fewer) left is shown as "running low"
const tracked=x=>x.stock!==null&&x.stock!==undefined&&x.stock!==''&&Number.isFinite(Number(x.stock));
const stockChip=x=>{
  if(!tracked(x)) return '';
  const n=Number(x.stock);
  return `<span class="stock ${n<=0?'out':n<=LOW_STOCK?'low':'ok'}">${n<=0?'Out of stock':n+' in stock'}</span>`;
};

export const savedPrice=name=>{
  const n=String(name||'').trim().toLowerCase();
  const hit=n&&cat.items.find(x=>String(x.name).toLowerCase()===n);
  return hit?Number(hit.price)||0:null;
};

export const savedPhone=name=>{
  const n=String(name||'').trim().toLowerCase();
  const hit=n&&cat.customers.find(x=>String(x.name).toLowerCase()===n);
  return hit&&hit.phone?String(hit.phone):'';
};

export function resetCatalog(){cat.items=[];cat.customers=[];cat.ok=true;draw()}

export async function loadCatalog(){
  if(!state.user) return;
  const uid=state.user.id;
  const [i,c]=await Promise.all([
    sb.from('saved_items').select('*').eq('user_id',uid).order('name',{ascending:true}).limit(500),
    sb.from('saved_customers').select('*').eq('user_id',uid).order('name',{ascending:true}).limit(500)
  ]);
  if(state.user?.id!==uid) return;
  const e=i.error||c.error;
  cat.ok=!e;
  cat.err=e?`${e.code||''} ${e.message||''}`.trim():'';
  if(e) console.warn('Saved items could not load',e);
  cat.items=i.data||[];cat.customers=c.data||[];
  draw();
}

function draw(){
  $('savedItemsData').innerHTML=cat.items.map(x=>`<option value="${safe(x.name)}"></option>`).join('');
  $('savedCustomersData').innerHTML=cat.customers.map(x=>`<option value="${safe(x.name)}"></option>`).join('');
  renderLow();
  $('catalogOff').hidden=cat.ok;
  $('catalogOff').textContent=cat.err?`Saved items and customers could not load (${cat.err}). Check your internet and reload the page.`:'Saved items and customers are not available yet.';
  $('catalogPanels').hidden=!cat.ok;
  const stockBtn=x=>`<button class="icon-btn" type="button" data-stock="${safe(x.id)}" title="Update stock" aria-label="Update stock of ${safe(x.name)}">${icon('refresh')}</button>`;
  const del=(kind,x)=>`<button class="icon-btn danger" type="button" data-del="${kind}" data-id="${safe(x.id)}" title="Delete" aria-label="Delete ${safe(x.name)}">${icon('trash')}</button>`;
  $('savedItemsList').innerHTML=cat.items.length
    ?cat.items.map(x=>`<div class="srow"><span class="srow-name">${safe(x.name)}</span><span class="srow-meta mono">₦${money(x.price)}</span>${stockChip(x)}${stockBtn(x)}${del('item',x)}</div>`).join('')
    :'<p class="muted">No saved items yet. Items you sell are added here when you save a receipt.</p>';
  $('savedCustomersList').innerHTML=cat.customers.length
    ?cat.customers.map(x=>`<div class="srow"><span class="srow-name">${safe(x.name)}</span><span class="srow-meta">${safe(x.phone||'')}</span>${del('customer',x)}</div>`).join('')
    :'<p class="muted">No saved customers yet. Customers are added here when you save a receipt.</p>';
}

// Dashboard note for items that are running low.
function renderLow(){
  const el=$('lowCallout');
  if(!el) return;
  const low=cat.ok?cat.items.filter(x=>tracked(x)&&Number(x.stock)<=LOW_STOCK).sort((a,b)=>Number(a.stock)-Number(b.stock)):[];
  el.hidden=!low.length;
  if(low.length){
    const shown=low.slice(0,5).map(x=>`${x.name} (${Number(x.stock)})`).join(', ');
    $('lowCalloutText').textContent=shown+(low.length>5?` and ${low.length-5} more`:'');
  }
}

// After a new receipt is saved, take the sold quantities off the stock of saved items that are being counted.
// Returns the items that are now running low, so the caller can say so.
export async function applyStock(d){
  if(!state.user||!cat.ok) return [];
  const uid=state.user.id,low=[];
  try{
    for(const line of d.items){
      const hit=cat.items.find(x=>String(x.name).toLowerCase()===String(line.name).toLowerCase());
      if(!hit||!tracked(hit)) continue;
      const left=Math.max(0,Math.round((Number(hit.stock)-(Number(line.qty)||0))*1000)/1000);
      const {error}=await sb.from('saved_items').update({stock:left}).eq('id',hit.id).eq('user_id',uid);
      if(error) throw error;
      hit.stock=left;
      if(left<=LOW_STOCK) low.push({name:hit.name,left});
    }
    await loadCatalog();
  }catch(e){console.warn('Could not update stock',e)}
  return low;
}

// After a receipt is saved: remember new items and the customer. Never blocks or breaks saving.
export async function rememberFromReceipt(d,customerTyped){
  if(!state.user||!cat.ok) return;
  try{
    const uid=state.user.id;
    const known=new Set(cat.items.map(x=>String(x.name).toLowerCase()));
    const newItems=d.items.filter(x=>!known.has(x.name.toLowerCase())).map(x=>({user_id:uid,name:x.name,price:x.price}));
    if(newItems.length) await sb.from('saved_items').upsert(newItems,{onConflict:'user_id,name'});
    const c=String(customerTyped||'').trim();
    if(c&&!cat.customers.some(x=>String(x.name).toLowerCase()===c.toLowerCase())) await sb.from('saved_customers').upsert({user_id:uid,name:c},{onConflict:'user_id,name'});
    await loadCatalog();
  }catch(e){console.warn('Could not update saved items',e)}
}

async function add(table,row,btn,okMsg){
  if(!state.user) return false;
  setBusy(btn,true);
  const {error}=await sb.from(table).upsert({user_id:state.user.id,...row},{onConflict:'user_id,name'});
  setBusy(btn,false);
  if(error){toast('Could not save: '+error.message,'error');return false}
  toast(okMsg,'success');
  await loadCatalog();
  return true;
}

export function initCatalog(){
  $('itemForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('newItemName').value.trim(),price=Math.max(0,Number($('newItemPrice').value)||0);
    if(!name){toast('Enter an item name.','error');return}
    const row={name,price},rawStock=$('newItemStock').value.trim();
    if(rawStock!==''&&Number.isFinite(Number(rawStock))&&Number(rawStock)>=0) row.stock=Number(rawStock);   // left out = keep any count already saved
    if(await add('saved_items',row,$('addSavedItem'),'Item saved.')){$('newItemName').value='';$('newItemPrice').value='';$('newItemStock').value=''}
  });
  $('customerForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('newCustomerName').value.trim(),phone=$('newCustomerPhone').value.trim();
    if(!name){toast('Enter a customer name.','error');return}
    if(await add('saved_customers',{name,phone},$('addSavedCustomer'),'Customer saved.')){$('newCustomerName').value='';$('newCustomerPhone').value=''}
  });
  $('catalogPanels').addEventListener('click',async e=>{
    const sb2=e.target.closest('[data-stock]');
    if(sb2&&state.user){
      const it=cat.items.find(x=>String(x.id)===sb2.dataset.stock);
      if(!it) return;
      const n=await askNumber({title:'Update stock',text:`How many "${it.name}" do you have now?`,label:'Items in stock',value:tracked(it)?Number(it.stock):'',min:0,okText:'Save stock'});
      if(n===null) return;
      const {error}=await sb.from('saved_items').update({stock:n}).eq('id',it.id).eq('user_id',state.user.id);
      if(error){toast('Could not update stock: '+error.message,'error');return}
      toast('Stock updated.','success');
      await loadCatalog();
      return;
    }
    const b=e.target.closest('[data-del]');
    if(!b||!state.user) return;
    const table=b.dataset.del==='item'?'saved_items':'saved_customers';
    const {error}=await sb.from(table).delete().eq('id',b.dataset.id).eq('user_id',state.user.id);
    if(error){toast('Could not delete: '+error.message,'error');return}
    toast('Deleted.','success');
    await loadCatalog();
  });
}
