export const $=id=>document.getElementById(id);
export const qs=(sel,root=document)=>root.querySelector(sel);
export const qsa=(sel,root=document)=>[...root.querySelectorAll(sel)];

export const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=n=>Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
export const today=()=>new Date().toLocaleDateString('en-CA');
export function nextNo(prefix='REC'){return prefix+'-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+String(Date.now()).slice(-5)}

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

// Small dialog that asks for one number (e.g. a payment amount). Resolves to the number, or null if cancelled.
export function askNumber({title='Enter a number',text='',label='Amount',value='',okText='Save',min=0,max=null,step='any',prefix=''}={}){
  const d=$('promptDialog');
  if(!d||typeof d.showModal!=='function'){
    const v=window.prompt(title+(text?'\n'+text:''),String(value));
    if(v===null) return Promise.resolve(null);
    const n=Number(v);return Promise.resolve(Number.isFinite(n)&&n>=min&&(max===null||n<=max)?n:null);
  }
  $('promptTitle').textContent=title;
  $('promptText').textContent=text;
  $('promptLabel').textContent=label+(prefix?' ('+prefix+')':'');
  const input=$('promptInput');
  input.value=value===''||value===null?'':String(value);
  input.min=String(min);
  if(max===null) input.removeAttribute('max'); else input.max=String(max);
  input.step=step;
  $('promptError').textContent='';
  $('promptOk').textContent=okText;
  return new Promise(resolve=>{
    d.returnValue='';
    const form=$('promptForm');
    const bad=()=>{const n=Number(input.value);return input.value===''||!Number.isFinite(n)||n<min||(max!==null&&n>max)};
    const onSubmit=e=>{
      if(e.submitter&&e.submitter.value==='ok'&&bad()){
        e.preventDefault();
        $('promptError').textContent=max!==null?`Enter a number from ${min} to ${max}.`:`Enter a number of ${min} or more.`;
      }
    };
    const onClose=()=>{
      form.removeEventListener('submit',onSubmit);d.removeEventListener('close',onClose);
      resolve(d.returnValue==='ok'&&!bad()?Number(input.value):null);
    };
    form.addEventListener('submit',onSubmit);
    d.addEventListener('close',onClose);
    d.showModal();
    setTimeout(()=>{input.focus();input.select()},30);
  });
}

// Download rows as a CSV file that opens correctly in Excel.
export function downloadCsv(filename,headers,rows){
  const cell=v=>{
    let t=v==null?'':String(v);
    if(/^[=+\-@\t\r]/.test(t)) t="'"+t;   // stops spreadsheet formulas from running
    return '"'+t.replace(/"/g,'""')+'"';
  };
  const text='\ufeff'+[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}

// Turns a typed phone number into the digits WhatsApp links need. Nigerian 080... becomes 23480...
export function waNumber(raw){
  let n=String(raw||'').replace(/[^\d]/g,'');
  if(n.startsWith('00')) n=n.slice(2);
  if(n.startsWith('0')) n='234'+n.slice(1);
  return n.length>=10?n:'';
}
