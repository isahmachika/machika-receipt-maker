export const $=id=>document.getElementById(id);
export const qs=(sel,root=document)=>root.querySelector(sel);
export const qsa=(sel,root=document)=>[...root.querySelectorAll(sel)];

export const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=n=>Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
export const today=()=>new Date().toLocaleDateString('en-CA');
export function nextNo(){return 'REC-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+String(Date.now()).slice(-5)}

export function fmtDate(v){
  if(!v) return '';
  const s=String(v);
  const d=/^\d{4}-\d{2}-\d{2}$/.test(s)?new Date(s+'T00:00:00'):new Date(s);
  return isNaN(d)?s:d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

export const icon=(name,cls='')=>`<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// Button busy state: disables the button and optionally swaps its label until released.
export function setBusy(btn,on,label){
  if(!btn) return;
  if(on){
    if(btn.dataset.html===undefined) btn.dataset.html=btn.innerHTML;
    btn.disabled=true;btn.setAttribute('aria-busy','true');
    if(label) btn.textContent=label;
  }else{
    btn.disabled=false;btn.removeAttribute('aria-busy');
    if(btn.dataset.html!==undefined){btn.innerHTML=btn.dataset.html;delete btn.dataset.html}
  }
}

// Non-blocking message (replaces alert()).
export function toast(message,type='info',ms=5000){
  const host=$('toasts'); if(!host) return;
  const el=document.createElement('div');
  el.className='toast toast-'+type;
  el.setAttribute('role',type==='error'?'alert':'status');
  el.innerHTML=icon(type==='error'?'alert':type==='success'?'check':'info')+'<span></span><button type="button" aria-label="Dismiss">'+icon('x')+'</button>';
  el.querySelector('span').textContent=message;
  const close=()=>el.remove();
  el.querySelector('button').addEventListener('click',close);
  host.appendChild(el);
  while(host.children.length>3) host.firstChild.remove();
  setTimeout(close,ms);
}

// Confirmation dialog (replaces confirm()). Resolves true when the person confirms.
export function confirmAction({title='Are you sure?',text='',okText='Confirm',danger=false}={}){
  const d=$('confirmDialog');
  if(!d||typeof d.showModal!=='function') return Promise.resolve(window.confirm(text||title));
  $('confirmTitle').textContent=title;
  $('confirmText').textContent=text;
  const ok=$('confirmOk');
  ok.textContent=okText;
  ok.className='btn '+(danger?'btn-danger-solid':'btn-primary');
  return new Promise(resolve=>{
    d.returnValue='';
    const done=()=>{d.removeEventListener('close',done);resolve(d.returnValue==='ok')};
    d.addEventListener('close',done);
    d.showModal();
  });
}

export async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true}catch{}
  try{
    const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok;
  }catch{return false}
}
