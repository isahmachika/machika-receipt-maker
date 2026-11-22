import {sb} from './supa.js';
import {$,qsa,safe,money,nextNo,today,icon,toast,setBusy,confirmAction} from './utils.js';
import {state,profileOf} from './state.js';
import {RECEIPT_BUCKET} from './config.js';
import {loadReceipts} from './receipts.js';
import {go} from './router.js';
import {savedPrice,rememberFromReceipt} from './catalog.js';

let logoData='';
const FIELDS=['business','phone','address','receiptNo','date','customer','payment','discount','note'];

/* ---------- Items ---------- */
export function addItem(name='',qty=1,price=''){
  const row=document.createElement('div');
  row.className='item-row';
  row.innerHTML=`<div class="cell item-name"><span class="cell-label">Item / service</span><input class="input iname" placeholder="Item name" aria-label="Item name" list="savedItemsData" autocomplete="off" value="${safe(name)}"></div>`+
    `<div class="cell cell-qty"><span class="cell-label">Quantity</span><input class="input iqty" type="number" min="0.01" step="any" inputmode="decimal" aria-label="Quantity" value="${safe(qty)}"></div>`+
    `<div class="cell cell-price"><span class="cell-label">Price (₦)</span><input class="input iprice" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" aria-label="Price" value="${safe(price)}"></div>`+
    `<output class="item-amount" aria-label="Line amount">₦0.00</output>`+
    `<button class="icon-btn danger remove" type="button" title="Remove item" aria-label="Remove item">${icon('trash')}</button>`;
  $('items').appendChild(row);
  row.querySelectorAll('input').forEach(i=>i.addEventListener('input',render));
  // Picking a saved item fills its usual price (only when the price is still empty).
  row.querySelector('.iname').addEventListener('change',e=>{const p=savedPrice(e.target.value),pr=row.querySelector('.iprice');if(p!==null&&!pr.value){pr.value=p;render()}});
  row.querySelector('.remove').addEventListener('click',()=>{row.remove();if(!$('items').children.length)addItem();render()});
  render();
  return row;
}

/* ---------- Values + receipt preview (same output as the original) ---------- */
export function values(){
  const items=qsa('.item-row').map(r=>({name:r.querySelector('.iname').value.trim(),qty:Math.max(0,Number(r.querySelector('.iqty').value)||0),price:Math.max(0,Number(r.querySelector('.iprice').value)||0)})).filter(x=>x.name);
  const subtotal=items.reduce((s,x)=>s+x.qty*x.price,0);
  const discount=Math.max(0,Number($('discount').value)||0);
  return {business:$('business').value.trim()||'Business Name',phone:$('phone').value.trim(),address:$('address').value.trim(),receiptNo:$('receiptNo').value.trim()||nextNo(),date:$('date').value,customer:$('customer').value.trim()||'Walk-in Customer',payment:$('payment').value,items,subtotal,discount,total:Math.max(0,subtotal-discount),note:$('note').value.trim()};
}

export function render(){
  const d=values();
  $('receipt').innerHTML=`${logoData?`<div class="center" style="margin-bottom:8px"><img src="${logoData}" alt="Shop logo" style="max-width:90px;max-height:70px;object-fit:contain"></div>`:''}<h3>${safe(d.business)}</h3><div class="meta">${safe(d.address)}${d.phone?'\nTel: '+safe(d.phone):''}</div><hr><div style="font-size:12px;line-height:1.7"><div><b>Receipt:</b> ${safe(d.receiptNo)}</div><div><b>Date:</b> ${safe(d.date||new Date().toLocaleDateString('en-CA'))}</div><div><b>Customer:</b> ${safe(d.customer)}</div><div><b>Payment:</b> ${safe(d.payment)}</div></div><hr><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead><tbody>${d.items.map(x=>`<tr><td>${safe(x.name)}</td><td class="num">${x.qty}</td><td class="num">${money(x.price)}</td><td class="num">${money(x.qty*x.price)}</td></tr>`).join('')||'<tr><td colspan="4" class="center">No items yet</td></tr>'}</tbody></table><hr><div style="font-size:13px;line-height:1.8"><div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>₦${money(d.subtotal)}</span></div><div style="display:flex;justify-content:space-between"><span>Discount</span><span>₦${money(d.discount)}</span></div><div class="total" style="display:flex;justify-content:space-between"><span>TOTAL</span><span>₦${money(d.total)}</span></div></div><hr><div class="foot">${safe(d.note||'Thank you for your patronage!')}</div>`;
  // Per-line amounts and the totals summary next to the form.
  qsa('.item-row').forEach(r=>{
    const q=Math.max(0,Number(r.querySelector('.iqty').value)||0),p=Math.max(0,Number(r.querySelector('.iprice').value)||0);
    r.querySelector('.item-amount').textContent='₦'+money(q*p);
  });
  $('sumSub').textContent='₦'+money(d.subtotal);
  $('sumDisc').textContent='₦'+money(d.discount);
  $('sumTotal').textContent='₦'+money(d.total);
  fitPreview();
}

// On a short screen a tall receipt would be cut off by the sticky preview, so let it scroll with the page instead.
function fitPreview(){
  const box=document.querySelector('.editor-preview');
  if(!box||box.offsetParent===null) return;
  box.classList.toggle('is-tall',box.offsetHeight>window.innerHeight-120);
}

/* ---------- Logo ---------- */
function setLogo(data){
  logoData=data;
  const img=$('logoImg');
  if(data) img.src=data; else img.removeAttribute('src');
  $('logoPrev').hidden=!data;
  render();
}
function initLogo(){
  $('logoFile').addEventListener('change',e=>{
    const file=e.target.files&&e.target.files[0];
    if(!file){setLogo('');return}
    if(!file.type.startsWith('image/')){toast('Please choose an image for the logo.','error');e.target.value='';return}
    if(file.size>2*1024*1024){toast('Logo is too large. Choose an image under 2MB.','error');e.target.value='';return}
    const reader=new FileReader();
    reader.onload=()=>setLogo(String(reader.result||''));
    reader.readAsDataURL(file);
  });
  $('logoRemove').addEventListener('click',()=>{$('logoFile').value='';setLogo('')});
}

/* ---------- Profile defaults ---------- */
// Fills business name, phone and address from the saved profile. Without `force` it never overwrites what is already typed.
export function applyProfile(force=false){
  const p=profileOf(state.user);
  [['business',p.business],['phone',p.phone],['address',p.address]].forEach(([id,v])=>{
    if(v&&(force||!$(id).value.trim())) $(id).value=v;
  });
  render();
}

/* ---------- Form actions ---------- */
export function loadReceipt(d){
  if(!d) return;
  FIELDS.forEach(k=>{if($(k))$(k).value=d[k]??''});
  $('items').innerHTML='';
  (d.items||[]).forEach(x=>addItem(x.name,x.qty,x.price));
  if(!$('items').children.length) addItem();
  render();
}

export function loadCloudReceipt(r){
  if(!r) return;
  const meta=r.items&&typeof r.items==='object'&&!Array.isArray(r.items)?r.items:{};
  const lines=Array.isArray(meta.lines)?meta.lines:(Array.isArray(r.items)?r.items:[]);
  loadReceipt({business:r.business_name||'',phone:meta.phone||'',address:meta.address||'',receiptNo:r.receipt_number||'',date:r.receipt_date||'',customer:r.customer_name||'',payment:meta.payment||'Cash',discount:meta.discount||0,note:meta.note||'',items:lines});
}

export function clearForm(){
  ['customer','note'].forEach(k=>$(k).value='');
  $('discount').value=0;
  $('receiptNo').value=nextNo();
  $('date').value=today();
  $('payment').value='Cash';
  $('items').innerHTML='';
  addItem();
  applyProfile(true);   // business details go back to the saved profile
}

// Used when the signed-in account changes, so one person's details are never shown to the next.
export function hardResetEditor(){
  ['business','phone','address'].forEach(k=>$(k).value='');
  $('logoFile').value='';
  logoData='';$('logoPrev').hidden=true;$('logoImg').removeAttribute('src');
  clearForm();
}

export function setEditorTab(tab){
  $('editorRoot').dataset.tab=tab;
  fitPreview();
  qsa('[data-editor-tab]').forEach(b=>{const on=b.dataset.editorTab===tab;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on))});
}

/* ---------- PNG ---------- */
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

async function captureReceiptCanvas(){
  render();
  const receipt=$('receipt');
  if(!receipt||!receipt.innerText.trim()) throw new Error('There is no receipt to save as an image.');
  if(typeof window.html2canvas==='undefined') throw new Error('The image library could not load. Check your internet connection.');
  // On phones the preview can be on the other tab; it must be on screen to be captured.
  const root=$('editorRoot'),prevTab=root.dataset.tab;
  if(prevTab!=='preview'){root.dataset.tab='preview';await nextFrame()}
  try{
    return await window.html2canvas(receipt,{backgroundColor:'#ffffff',scale:3,useCORS:true,logging:false,windowWidth:Math.max(document.documentElement.clientWidth,receipt.scrollWidth),scrollX:0,scrollY:0});
  }finally{
    if(prevTab!=='preview') root.dataset.tab=prevTab;
  }
}

const canvasToBlob=(canvas,type,q)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create the receipt file.')),type,q));
async function makeReceiptPngBlob(){return canvasToBlob(await captureReceiptCanvas(),'image/png')}

/* ---------- PDF (built here, no extra library): one A4 page with the receipt image ---------- */
function buildPdf(jpeg,imgW,imgH){
  const enc=new TextEncoder(),parts=[],offs=[];let len=0;
  const push=b=>{const u=typeof b==='string'?enc.encode(b):b;parts.push(u);len+=u.length};
  const W=595,H=842,maxW=330,maxH=H-80;
  const k=Math.min(maxW/imgW,maxH/imgH),w=(imgW*k).toFixed(2),h=(imgH*k).toFixed(2);
  const x=((W-imgW*k)/2).toFixed(2),y=(H-40-imgH*k).toFixed(2);
  const content=`q ${w} 0 0 ${h} ${x} ${y} cm /Im0 Do Q`;
  const obj=(n,body)=>{offs[n]=len;push(n+' 0 obj\n'+body+'\nendobj\n')};
  push('%PDF-1.4\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offs[4]=len;push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);push(jpeg);push('\nendstream\nendobj\n');
  obj(5,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref=len;
  push('xref\n0 6\n0000000000 65535 f \n'+[1,2,3,4,5].map(n=>String(offs[n]).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts,{type:'application/pdf'});
}

async function makeReceiptPdfBlob(){
  const canvas=await captureReceiptCanvas();
  const jpg=await canvasToBlob(canvas,'image/jpeg',0.92);
  return buildPdf(new Uint8Array(await jpg.arrayBuffer()),canvas.width,canvas.height);
}

function saveBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.download=filename;a.href=url;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
const fileBase=()=>($('receiptNo').value.trim()||'receipt').replace(/[^a-z0-9_-]/gi,'_');

async function downloadPdf(){
  const btn=$('pdf');
  setBusy(btn,true,'Preparing...');
  try{
    saveBlob(await makeReceiptPdfBlob(),fileBase()+'.pdf');
    toast('Receipt PDF downloaded.','success');
  }catch(err){
    console.error(err);
    toast('Could not create the PDF. Please try again.','error');
  }finally{setBusy(btn,false)}
}

// Phones open the share sheet (WhatsApp, Telegram, ...) with the receipt image. Where that is not possible, WhatsApp opens with the receipt details as text.
async function shareReceipt(){
  const btn=$('share'),d=values();
  const text=`Receipt ${d.receiptNo} from ${d.business}\nCustomer: ${d.customer}\nTotal: \u20a6${money(d.total)}`;
  setBusy(btn,true,'Preparing...');
  try{
    const blob=await makeReceiptPngBlob();
    const file=new File([blob],fileBase()+'.png',{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:'Receipt '+d.receiptNo,text});
    }else{
      window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');
      toast('This device cannot share the image directly. Download the PNG and attach it in WhatsApp.','info',8000);
    }
  }catch(err){
    if(err&&err.name==='AbortError') return;   // the person closed the share sheet
    console.error(err);
    toast('Could not share the receipt. Please try again.','error');
  }finally{setBusy(btn,false)}
}

async function downloadPng(){
  const btn=$('image');
  setBusy(btn,true,'Preparing...');
  try{
    const blob=await makeReceiptPngBlob();
    saveBlob(blob,fileBase()+'.png');
    toast('Receipt image downloaded.','success');
  }catch(err){
    console.error(err);
    toast('Could not download the receipt image. Please try again.','error');
  }finally{setBusy(btn,false)}
}

async function saveReceiptImage(receiptNo){
  const blob=await makeReceiptPngBlob();
  const safeNo=String(receiptNo||'receipt').replace(/[^a-z0-9_-]/gi,'_');
  const imagePath=state.user.id+'/'+safeNo+'.png';
  const {error}=await sb.storage.from(RECEIPT_BUCKET).upload(imagePath,blob,{contentType:'image/png',upsert:true});
  if(error) throw new Error('Image upload failed: '+error.message+' (ensure receipt-images Storage bucket and policies are set up)');
  return imagePath;
}

/* ---------- Save to the account ---------- */
async function save(){
  if(!state.user){toast('Please log in or create an account before saving a receipt online.','error');return}
  // If the number was left blank, lock one in now so the image and the saved row always match.
  if(!$('receiptNo').value.trim()) $('receiptNo').value=nextNo();
  const d=values();
  if(!d.items.length){toast('Please add at least one named item.','error');return}
  const btn=$('save');
  setBusy(btn,true,'Saving...');
  try{
    let imagePath;
    try{imagePath=await saveReceiptImage(d.receiptNo)}
    catch(err){toast('Could not save the receipt image. '+err.message,'error');return}
    const row={user_id:state.user.id,receipt_number:d.receiptNo,business_name:d.business,customer_name:d.customer,receipt_date:d.date||new Date().toLocaleDateString('en-CA'),items:{lines:d.items,discount:d.discount,phone:d.phone,address:d.address,payment:d.payment,note:d.note},subtotal:d.subtotal,tax:0,total:d.total,currency:'NGN',image_path:imagePath};
    const {data:existing,error:findErr}=await sb.from('receipts').select('id,image_path').eq('user_id',state.user.id).eq('receipt_number',d.receiptNo).maybeSingle();
    if(findErr){toast('Could not save receipt. Check the receipts table and policies. ('+findErr.message+')','error');return}
    const result=existing
      ?await sb.from('receipts').update(row).eq('id',existing.id).eq('user_id',state.user.id)
      :await sb.from('receipts').insert(row);
    if(result.error){toast('Could not save receipt details: '+result.error.message+' If it mentions image_path, run the SQL setup instructions first.','error');return}
    await loadReceipts({force:true});
    rememberFromReceipt(d,$('customer').value);
    toast('Receipt saved to your account. You can open it again any time from Receipts.','success');
    go('/my-receipts');
  }finally{setBusy(btn,false)}
}

/* ---------- Setup ---------- */
export function initEditor(){
  FIELDS.forEach(k=>$(k).addEventListener('input',render));
  $('date').value=today();
  $('receiptNo').value=nextNo();
  addItem();
  initLogo();
  $('addItem').addEventListener('click',()=>{const row=addItem();row.querySelector('.iname').focus()});
  $('save').addEventListener('click',save);
  $('image').addEventListener('click',downloadPng);
  $('pdf').addEventListener('click',downloadPdf);
  $('share').addEventListener('click',shareReceipt);
  $('clear').addEventListener('click',async()=>{
    const ok=await confirmAction({title:'Start a new receipt?',text:'Make sure you saved the current one if needed.',okText:'New receipt'});
    if(ok) clearForm();
  });
  qsa('[data-editor-tab]').forEach(b=>b.addEventListener('click',()=>setEditorTab(b.dataset.editorTab)));
  window.addEventListener('resize',fitPreview);
}
