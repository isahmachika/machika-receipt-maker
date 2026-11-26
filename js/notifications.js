import {$,safe,money} from './utils.js';
import {state,profileOf} from './state.js';
import {lowStockItems} from './catalog.js';

// The bell in the top bar. It is built from what the app already knows (who owes you, stock, business details),
// so it needs no extra database table. "Read" is remembered in this browser only.
const round2=n=>Math.round((Number(n)||0)*100)/100;
const owed=r=>round2(Math.max(0,(Number(r.total)||0)-(r.payment_status==='unpaid'?0:(Number(r.amount_paid)||0))));
const key=()=>'machika-seen-'+(state.user?.id||'');
const readSeen=()=>{try{return new Set(JSON.parse(localStorage.getItem(key())||'[]'))}catch{return new Set()}};
const writeSeen=ids=>{try{localStorage.setItem(key(),JSON.stringify([...ids].slice(-60)))}catch{/* ignore */}};

let items=[];

function build(){
  const out=[];
  if(!state.user) return out;
  const p=profileOf(state.user);
  if(!(p.business&&p.phone&&p.address)){
    out.push({id:'profile',title:'Finish your business profile',text:'Add your shop name, phone and address so they appear on every receipt.',href:'/profile'});
  }
  if(state.receiptsLoaded){
    const rows=state.owing.filter(r=>r.doc_type!=='quote').map(owed).filter(b=>b>0);
    if(rows.length){
      const total=round2(rows.reduce((s,b)=>s+b,0));
      out.push({id:'owing:'+rows.length+':'+total,title:'₦'+money(total)+' still owed to you',text:`${rows.length} receipt${rows.length===1?'':'s'} ${rows.length===1?'has':'have'} a balance to collect.`,href:'/money'});
    }
  }
  const low=lowStockItems();
  if(low.length){
    const shown=low.slice(0,3).map(x=>`${x.name} (${x.left<=0?'out':x.left})`).join(', ');
    out.push({id:'low:'+low.map(x=>x.name+x.left).join('|'),title:`${low.length} item${low.length===1?' is':'s are'} running low`,text:shown+(low.length>3?` and ${low.length-3} more`:''),href:'/profile'});
  }
  return out;
}

function draw(){
  const seen=readSeen();
  items=build();
  const fresh=items.filter(i=>!seen.has(i.id)).length;
  const dot=$('bellDot');
  dot.hidden=!fresh;dot.textContent=fresh>9?'9+':String(fresh);
  $('bellBtn').setAttribute('aria-label',fresh?`Notifications, ${fresh} new`:'Notifications');
  $('bellList').innerHTML=items.length
    ?items.map(i=>`<a class="bell-item${seen.has(i.id)?'':' is-new'}" href="${i.href}" data-route="${i.href}"><b>${safe(i.title)}</b><span>${safe(i.text)}</span></a>`).join('')
    :'<p class="bell-empty">You are all caught up. Nothing needs your attention.</p>';
}

function setOpen(open){
  $('bellPanel').hidden=!open;
  $('bellBtn').setAttribute('aria-expanded',open?'true':'false');
}
function markRead(){
  const seen=readSeen();items.forEach(i=>seen.add(i.id));writeSeen(seen);draw();
}

export function initNotifications(){
  if(!$('bellBtn')) return;
  $('bellBtn').addEventListener('click',e=>{e.stopPropagation();draw();setOpen($('bellPanel').hidden)});
  $('bellRead').addEventListener('click',markRead);
  $('bellList').addEventListener('click',()=>{setOpen(false);setTimeout(markRead,0)});
  document.addEventListener('click',e=>{if(!$('bellPanel').hidden&&!$('bellWrap').contains(e.target)) setOpen(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('bellPanel').hidden){setOpen(false);$('bellBtn').focus()}});
  document.addEventListener('notify:refresh',draw);
  window.addEventListener('popstate',()=>setOpen(false));
  draw();
}
