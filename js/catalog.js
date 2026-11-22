import {sb} from './supa.js';
import {$,qsa,safe,money,icon,toast,setBusy} from './utils.js';
import {state} from './state.js';

// Saved items (name + usual price) and saved customers, kept per account.
// If the two Supabase tables are not created yet, everything here quietly switches off and receipts still work.
const cat={items:[],customers:[],ok:true};

export const savedPrice=name=>{
  const n=String(name||'').trim().toLowerCase();
  const hit=n&&cat.items.find(x=>String(x.name).toLowerCase()===n);
  return hit?Number(hit.price)||0:null;
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
  cat.ok=!(i.error||c.error);
  cat.items=i.data||[];cat.customers=c.data||[];
  draw();
}

function draw(){
  $('savedItemsData').innerHTML=cat.items.map(x=>`<option value="${safe(x.name)}"></option>`).join('');
  $('savedCustomersData').innerHTML=cat.customers.map(x=>`<option value="${safe(x.name)}"></option>`).join('');
  $('catalogOff').hidden=cat.ok;
  $('catalogPanels').hidden=!cat.ok;
  const del=(kind,x)=>`<button class="icon-btn danger" type="button" data-del="${kind}" data-id="${safe(x.id)}" title="Delete" aria-label="Delete ${safe(x.name)}">${icon('trash')}</button>`;
  $('savedItemsList').innerHTML=cat.items.length
    ?cat.items.map(x=>`<div class="srow"><span class="srow-name">${safe(x.name)}</span><span class="srow-meta mono">₦${money(x.price)}</span>${del('item',x)}</div>`).join('')
    :'<p class="muted">No saved items yet. Items you sell are added here when you save a receipt.</p>';
  $('savedCustomersList').innerHTML=cat.customers.length
    ?cat.customers.map(x=>`<div class="srow"><span class="srow-name">${safe(x.name)}</span><span class="srow-meta">${safe(x.phone||'')}</span>${del('customer',x)}</div>`).join('')
    :'<p class="muted">No saved customers yet. Customers are added here when you save a receipt.</p>';
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
    if(await add('saved_items',{name,price},$('addSavedItem'),'Item saved.')){$('newItemName').value='';$('newItemPrice').value=''}
  });
  $('customerForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('newCustomerName').value.trim(),phone=$('newCustomerPhone').value.trim();
    if(!name){toast('Enter a customer name.','error');return}
    if(await add('saved_customers',{name,phone},$('addSavedCustomer'),'Customer saved.')){$('newCustomerName').value='';$('newCustomerPhone').value=''}
  });
  $('catalogPanels').addEventListener('click',async e=>{
    const b=e.target.closest('[data-del]');
    if(!b||!state.user) return;
    const table=b.dataset.del==='item'?'saved_items':'saved_customers';
    const {error}=await sb.from(table).delete().eq('id',b.dataset.id).eq('user_id',state.user.id);
    if(error){toast('Could not delete: '+error.message,'error');return}
    toast('Deleted.','success');
    await loadCatalog();
  });
}
