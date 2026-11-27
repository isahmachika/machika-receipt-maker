import {sb} from './supa.js';
import {$,qsa,safe,money,icon,fmtDate,today,toast,confirmAction,askNumber,setBusy,downloadCsv,waNumber} from './utils.js';
import {state} from './state.js';
import {loadReceipts,salesRows,badgesHTML} from './receipts.js';
import {savedPhone} from './catalog.js';

// Money: who owes you, what you spent, and your profit.
const round2=n=>Math.round((Number(n)||0)*100)/100;
const inMonth=(v,pre)=>String(v||'').startsWith(pre);
const owed=r=>round2(Math.max(0,(Number(r.total)||0)-(r.payment_status==='unpaid'?0:(Number(r.amount_paid)||0))));
const metaOf=r=>r.items&&typeof r.items==='object'&&!Array.isArray(r.items)?r.items:{};

/* ---------- Data ---------- */
export async function loadExpenses(){
  if(!state.user) return;
  const uid=state.user.id;
  const {data,error}=await sb.from('expenses').select('*').eq('user_id',uid).order('expense_date',{ascending:false}).limit(1000);
  if(state.user?.id!==uid) return;
  state.expensesOk=!error;
  state.expenses=error?[]:(data||[]);
  state.expensesLoaded=true;
  if(error) console.warn('Expenses could not load',error);
  renderMoney();
}

export function resetMoney(){
  state.owing=[];state.expenses=[];state.expensesLoaded=false;state.expensesOk=true;
  renderMoney();
}

/* ---------- Rendering ---------- */
export function renderMoney(){
  const pre=today().slice(0,7);
  const haveReceipts=state.receiptsLoaded,haveExpenses=state.expensesLoaded&&state.expensesOk;
  const sales=salesRows().filter(r=>inMonth(r.receipt_date,pre)).reduce((s,r)=>s+(Number(r.total)||0),0);
  const spent=state.expenses.filter(x=>inMonth(x.expense_date,pre)).reduce((s,x)=>s+(Number(x.amount)||0),0);
  const profit=sales-spent;
  const owedTotal=state.owing.reduce((s,r)=>s+owed(r),0);
  const peso=n=>(n<0?'-₦':'₦')+money(Math.abs(n));

  // Dashboard
  $('statExpMonth').textContent=haveExpenses?peso(spent):'—';
  $('statProfitMonth').textContent=haveExpenses&&haveReceipts?peso(profit):'—';
  const owe=$('oweCallout');
  owe.hidden=!(haveReceipts&&state.owing.length&&owedTotal>0);
  if(!owe.hidden){
    $('oweCalloutTitle').textContent='₦'+money(owedTotal)+' owed to you';
    $('oweCalloutText').textContent=`${state.owing.length} receipt${state.owing.length===1?'':'s'} still ${state.owing.length===1?'has':'have'} a balance to collect.`;
  }

  // Money page
  $('moOwed').textContent=haveReceipts?'₦'+money(owedTotal):'—';
  $('moExp').textContent=haveExpenses?peso(spent):'—';
  $('moProfit').textContent=haveExpenses&&haveReceipts?peso(profit):'—';
  drawOwing();
  drawExpenses(pre);
  document.dispatchEvent(new Event('notify:refresh'));
}

function drawOwing(){
  const el=$('owingList');
  if(!state.receiptsLoaded){el.innerHTML='';return}
  const rows=state.owing.filter(r=>owed(r)>0);
  el.innerHTML=rows.length?rows.map(r=>{
    const due=metaOf(r).due;
    return `<article class="rrow owe" data-id="${safe(r.id)}">`+
      `<div class="rrow-main"><b>${safe(r.receipt_number)}</b><span class="who">${safe(r.customer_name||'Customer')}</span><span>${safe(fmtDate(r.receipt_date))}${due?' · due '+safe(fmtDate(due)):''}</span>${badgesHTML(r)}</div>`+
      `<div class="rrow-total">₦${money(owed(r))}<small class="owe-note">of ₦${money(r.total)}</small></div>`+
      `<div class="rrow-actions owe-actions"><button class="btn btn-sm btn-primary" type="button" data-act="pay">Record payment</button><button class="btn btn-sm" type="button" data-act="remind">Remind on WhatsApp</button><button class="icon-btn" type="button" data-act="open" title="Open and edit" aria-label="Open and edit receipt ${safe(r.receipt_number)}">${icon('pencil')}</button></div>`+
      `</article>`;
  }).join(''):`<div class="empty">${icon('check')}<b>Nobody owes you</b><span>When you save an invoice or a part payment, it shows here until it is paid.</span></div>`;
}

function drawExpenses(pre){
  $('expensesOff').hidden=state.expensesOk;
  $('expensesPanels').hidden=!state.expensesOk;
  const list=state.expenses;
  const month=list.filter(x=>inMonth(x.expense_date,pre));
  const monthTotal=month.reduce((s,x)=>s+(Number(x.amount)||0),0);
  $('expSum').textContent=state.expensesLoaded?(month.length?`This month: ₦${money(monthTotal)} from ${month.length} expense${month.length===1?'':'s'}.`:'No expenses saved this month yet.'):'';
  $('expensesList').innerHTML=list.length
    ?list.slice(0,200).map(x=>`<div class="srow"><span class="srow-name">${safe(x.title)}<small class="srow-sub">${safe(fmtDate(x.expense_date))}</small></span><span class="srow-meta mono">₦${money(x.amount)}</span><button class="icon-btn danger" type="button" data-del-expense="${safe(x.id)}" title="Delete" aria-label="Delete ${safe(x.title)}">${icon('trash')}</button></div>`).join('')
    :'<p class="muted">No expenses yet. Add rent, transport, stock or anything you spend on the business.</p>';
}

/* ---------- Actions ---------- */
async function recordPayment(r){
  const balance=owed(r);
  const amt=await askNumber({
    title:'Record a payment',
    text:`${r.customer_name||'Customer'} owes ₦${money(balance)} on ${r.receipt_number}.`,
    label:'Amount received',prefix:'₦',value:balance,min:0.01,max:balance,okText:'Record payment'
  });
  if(amt===null) return;
  const total=Number(r.total)||0;
  const paid=round2((r.payment_status==='unpaid'?0:(Number(r.amount_paid)||0))+amt);
  const status=paid>=total?'paid':'part';
  const {error}=await sb.from('receipts').update({amount_paid:Math.min(paid,total),payment_status:status}).eq('id',r.id).eq('user_id',state.user.id);
  if(error){toast('Could not record the payment: '+error.message,'error');return}
  toast(status==='paid'?'Paid in full. Well done!':`Payment of ₦${money(amt)} recorded. ₦${money(round2(total-paid))} is still owed.`,'success');
  await loadReceipts({force:true});
}

function remind(r){
  const num=waNumber(savedPhone(r.customer_name));
  const kind=r.doc_type==='invoice'?'invoice':'receipt';
  const due=metaOf(r).due;
  const text=`Hello ${r.customer_name||''},\nThis is a friendly reminder from ${r.business_name||'us'}.\n₦${money(owed(r))} is still unpaid on ${kind} ${r.receipt_number} (total ₦${money(r.total)}).${due?'\nDue date: '+due+'.':''}\nThank you.`;
  window.open('https://wa.me/'+num+'?text='+encodeURIComponent(text),'_blank','noopener');
  if(!num) toast('No saved phone number for this customer, so choose the contact in WhatsApp. Save the number in Business profile to skip this step.','info',8000);
}

async function addExpense(e){
  e.preventDefault();
  if(!state.user) return;
  const title=$('expTitle').value.trim(),raw=$('expAmount').value,amount=Number(raw),date=$('expDate').value||today();
  if(!title){toast('Write what the money was spent on.','error');$('expTitle').focus();return}
  if(raw===''||!Number.isFinite(amount)||amount<0){toast('Enter the amount you spent.','error');$('expAmount').focus();return}
  const btn=$('addExpense');
  setBusy(btn,true,'Saving...');
  const {error}=await sb.from('expenses').insert({user_id:state.user.id,title:title.slice(0,120),amount,expense_date:date});
  setBusy(btn,false);
  if(error){toast('Could not save the expense: '+error.message,'error');return}
  $('expTitle').value='';$('expAmount').value='';$('expTitle').focus();
  toast('Expense saved.','success');
  await loadExpenses();
}

async function deleteExpense(id){
  const x=state.expenses.find(e=>String(e.id)===String(id));
  if(!x) return;
  const ok=await confirmAction({title:'Delete this expense?',text:`${x.title} (₦${money(x.amount)}) will be removed.`,okText:'Delete expense',danger:true});
  if(!ok) return;
  const {error}=await sb.from('expenses').delete().eq('id',x.id).eq('user_id',state.user.id);
  if(error){toast('Could not delete the expense: '+error.message,'error');return}
  toast('Expense deleted.','success');
  await loadExpenses();
}

function exportExpenses(){
  const rows=state.expenses.map(x=>[x.expense_date||'',x.title||'',Number(x.amount)||0]);
  downloadCsv('machika-expenses-'+today()+'.csv',['Date','What for','Amount'],rows);
  toast(`Downloaded ${rows.length} expense${rows.length===1?'':'s'}.`,'success');
}

export function showMoneyTab(tab){
  qsa('#moneyTabs [data-money]').forEach(b=>{const on=b.dataset.money===tab;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on))});
  $('moneyOwing').hidden=tab!=='owing';
  $('moneyExpenses').hidden=tab!=='expenses';
}

export function initMoney(){
  qsa('#moneyTabs [data-money]').forEach(b=>b.addEventListener('click',()=>showMoneyTab(b.dataset.money)));
  $('expenseForm').addEventListener('submit',addExpense);
  $('expensesCsv').addEventListener('click',exportExpenses);
  $('expensesList').addEventListener('click',e=>{const b=e.target.closest('[data-del-expense]');if(b) deleteExpense(b.dataset.delExpense)});
  $('owingList').addEventListener('click',async e=>{
    const btn=e.target.closest('[data-act]');if(!btn) return;
    const row=btn.closest('[data-id]'),r=row&&state.owing.find(x=>String(x.id)===row.dataset.id);
    if(!r) return;
    if(btn.dataset.act==='pay') await recordPayment(r);
    else if(btn.dataset.act==='remind') remind(r);
    else if(btn.dataset.act==='open') document.dispatchEvent(new CustomEvent('receipt:open',{detail:r}));
  });
  document.addEventListener('receipts:updated',renderMoney);
  $('expDate').value=today();
}
