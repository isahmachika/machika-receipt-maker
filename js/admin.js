import {sb} from './supa.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';
import {$,qsa,safe,money,toast,confirmAction} from './utils.js';

let view='stats';

function setStatus(msg,isError=false){
  const el=$('adminStatus');
  el.textContent=msg;
  el.className='status'+(isError?' error':'');
}

function setActiveTab(action){
  qsa('#adminTabs [data-admin]').forEach(b=>{const on=b.dataset.admin===action;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on))});
}

// The server decides who is an admin on every request.
async function callAdmin(action,extraData={}){
  const {data,error}=await sb.auth.getSession();
  if(error||!data.session) throw new Error('Please log in again.');
  const response=await fetch(SUPABASE_URL+'/functions/v1/machika-admin',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+data.session.access_token},
    body:JSON.stringify({action,...extraData})
  });
  let result={};
  try{result=await response.json()}catch{}
  if(!response.ok){
    const details=result.details?(typeof result.details==='string'?result.details:JSON.stringify(result.details)):'';
    const code=result.code?' ['+result.code+']':'';
    throw new Error((result.error||('Admin request failed ('+response.status+').'))+code+(details?' — '+details:''));
  }
  return result;
}

async function adminUserAction(action,userId){
  const isBan=action==='ban-user';
  const ok=userId&&await confirmAction({
    title:isBan?'Ban this user?':'Unban this user?',
    text:isBan?'They will be blocked from signing in until an admin unbans them.':'Unban this user and allow them to sign in again?',
    okText:isBan?'Ban user':'Unban user',danger:isBan
  });
  if(!ok) return;
  try{
    await callAdmin(action,{user_id:userId});
    toast(isBan?'User has been banned.':'User has been unbanned.','success');
    await loadAdminData('users');
  }catch(error){
    toast('Could not '+(isBan?'ban':'unban')+' user: '+error.message,'error');
  }
}

const statCard=(label,value)=>`<div class="stat"><small>${safe(label)}</small><b>${safe(typeof value==='number'?value.toLocaleString('en-NG'):value)}</b></div>`;
const when=v=>v?new Date(v).toLocaleString():'—';

// Download rows as a CSV file that opens correctly in Excel.
function downloadCsv(filename,headers,rows){
  const cell=v=>{
    let t=v==null?'':String(v);
    if(/^[=+\-@\t\r]/.test(t)) t="'"+t;   // stops spreadsheet formulas from running
    return '"'+t.replace(/"/g,'""')+'"';
  };
  const text='﻿'+[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
const today=()=>new Date().toISOString().slice(0,10);
const isBanned=u=>!!(u.banned_until&&new Date(u.banned_until).getTime()>Date.now());
const isNew=u=>u.created_at&&Date.now()-new Date(u.created_at).getTime()<864e5;
const time=v=>v?new Date(v).getTime():0;

function usersTable(users){
  $('adminResults').innerHTML=
    '<div class="admin-tools">'+
     '<div class="admin-search"><label for="adminUserSearch">Search users by email</label><input id="adminUserSearch" type="search" placeholder="Type an email to search..." autocomplete="off"></div>'+
     '<div class="admin-search"><label for="adminUserFilter">Show</label><select class="input" id="adminUserFilter"><option value="all">All users</option><option value="active">Active only</option><option value="banned">Banned only</option><option value="never">Never signed in</option></select></div>'+
     '<div class="admin-search"><label for="adminUserSort">Sort by</label><select class="input" id="adminUserSort"><option value="newest">Newest registered</option><option value="oldest">Oldest registered</option><option value="signin">Last sign-in</option><option value="email">Email (A-Z)</option></select></div>'+
     '<button type="button" class="btn btn-sm" id="adminUsersCsv">Download CSV</button>'+
    '</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Registered</th><th>Last sign-in</th><th>Status</th><th>Action</th></tr></thead><tbody id="adminUsersBody"></tbody></table></div>';
  let shown=users;
  const renderUsers=()=>{
    const q=$('adminUserSearch').value.trim().toLowerCase(),f=$('adminUserFilter').value,so=$('adminUserSort').value;
    shown=users.filter(u=>(u.email||'').toLowerCase().includes(q)).filter(u=>f==='all'||(f==='active'&&!isBanned(u))||(f==='banned'&&isBanned(u))||(f==='never'&&!u.last_sign_in_at));
    shown=[...shown].sort((x,y)=>so==='oldest'?time(x.created_at)-time(y.created_at):so==='signin'?time(y.last_sign_in_at)-time(x.last_sign_in_at):so==='email'?(x.email||'').localeCompare(y.email||''):time(y.created_at)-time(x.created_at));
    $('adminUsersBody').innerHTML=shown.map(u=>{
      const banned=isBanned(u);
      const action=banned?'unban-user':'ban-user';
      return '<tr><td class="break">'+safe(u.email||'—')+(isNew(u)?' <span class="pill">New</span>':'')+'</td><td>'+safe(when(u.created_at))+'</td><td>'+safe(u.last_sign_in_at?when(u.last_sign_in_at):'Never')+'</td>'+
        '<td><span class="pill '+(banned?'bad':'ok')+'">'+(banned?'Banned':'Active')+'</span></td>'+
        '<td><button type="button" class="btn '+(banned?'btn-unban':'btn-ban')+'" data-user-action="'+action+'" data-user-id="'+safe(u.id||'')+'">'+(banned?'Unban':'Ban')+'</button></td></tr>';
    }).join('')||'<tr><td colspan="5">No users match.</td></tr>';
    setStatus('Showing '+shown.length+' of '+users.length+' users (maximum 100 per request). Admin accounts and your own account are protected.');
  };
  ['input','change'].forEach(ev=>{$('adminUserSearch').addEventListener(ev,renderUsers);$('adminUserFilter').addEventListener(ev,renderUsers);$('adminUserSort').addEventListener(ev,renderUsers)});
  $('adminUsersCsv').addEventListener('click',()=>{
    downloadCsv('machika-users-'+today()+'.csv',['Email','Registered','Last sign-in','Status'],shown.map(u=>[u.email||'',u.created_at||'',u.last_sign_in_at||'Never',isBanned(u)?'Banned':'Active']));
    toast('Downloaded '+shown.length+' users.','success');
  });
  $('adminUsersBody').addEventListener('click',async e=>{
    const b=e.target.closest('button[data-user-action]');
    if(b) await adminUserAction(b.dataset.userAction,b.dataset.userId);
  });
  renderUsers();
}

function receiptsTable(receipts){
  if(!receipts.length){$('adminResults').innerHTML='<p class="muted">No receipts returned.</p>';return}
  $('adminResults').innerHTML=
    '<div class="admin-tools">'+
     '<div class="admin-search"><label for="adminReceiptSearch">Search receipts</label><input id="adminReceiptSearch" type="search" placeholder="Receipt number, business or customer..." autocomplete="off"></div>'+
     '<div class="admin-search"><label for="adminReceiptSort">Sort by</label><select class="input" id="adminReceiptSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="high">Highest total</option><option value="low">Lowest total</option></select></div>'+
     '<button type="button" class="btn btn-sm" id="adminReceiptsCsv">Download CSV</button>'+
    '</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Receipt</th><th>Business</th><th>Customer</th><th class="r">Total</th><th>Created</th></tr></thead><tbody id="adminReceiptsBody"></tbody></table></div>';
  let shown=receipts;
  const render=()=>{
    const q=$('adminReceiptSearch').value.trim().toLowerCase(),so=$('adminReceiptSort').value;
    shown=receipts.filter(r=>[r.receipt_number,r.business_name,r.customer_name].some(v=>String(v||'').toLowerCase().includes(q)));
    shown=[...shown].sort((x,y)=>so==='oldest'?time(x.created_at)-time(y.created_at):so==='high'?(Number(y.total)||0)-(Number(x.total)||0):so==='low'?(Number(x.total)||0)-(Number(y.total)||0):time(y.created_at)-time(x.created_at));
    $('adminReceiptsBody').innerHTML=shown.map(r=>'<tr><td class="mono break">'+safe(r.receipt_number||'—')+'</td><td>'+safe(r.business_name||'—')+'</td><td>'+safe(r.customer_name||'—')+'</td><td class="r mono">₦'+money(r.total)+'</td><td>'+safe(when(r.created_at))+'</td></tr>').join('')||'<tr><td colspan="5">No receipts match.</td></tr>';
    const sum=shown.reduce((t,r)=>t+(Number(r.total)||0),0);
    setStatus('Showing '+shown.length+' of '+receipts.length+' recent receipts (maximum 100). Total of shown: ₦'+money(sum)+'.');
  };
  $('adminReceiptSearch').addEventListener('input',render);
  $('adminReceiptSort').addEventListener('change',render);
  $('adminReceiptsCsv').addEventListener('click',()=>{
    downloadCsv('machika-receipts-'+today()+'.csv',['Receipt','Business','Customer','Total','Created'],shown.map(r=>[r.receipt_number||'',r.business_name||'',r.customer_name||'',Number(r.total)||0,r.created_at||'']));
    toast('Downloaded '+shown.length+' receipts.','success');
  });
  render();
}

function analyticsChart(days){
  const max=Math.max(1,...days.map(d=>Math.max(Number(d.receipts)||0,Number(d.visits)||0)));
  const bar=(label,n,cls)=>'<div class="bar"><span>'+label+'</span><span class="bar-track"><span class="bar-fill '+cls+'" style="width:'+Math.round((Number(n)||0)/max*100)+'%"></span></span><em>'+(n||0)+'</em></div>';
  $('adminResults').innerHTML=days.length
    ?'<div class="chart"><h3>Receipts and visits — last 7 days</h3>'+days.map(d=>'<div class="chart-row"><b>'+safe(d.date)+'</b>'+bar('Receipts',d.receipts,'')+bar('Visits',d.visits,'alt')+'</div>').join('')+'</div>'
    :'<p class="muted">No analytics data returned.</p>';
}

export async function loadAdminData(action=view){
  view=action;
  setActiveTab(action);
  setStatus('Loading admin data...');
  $('adminResults').innerHTML='';
  if(action==='stats') $('adminStats').innerHTML='';
  try{
    const result=await callAdmin(action);
    if(action==='stats'){
      $('adminStats').innerHTML=statCard('Registered Users',result.users??0)+statCard('Active Users',result.activeUsers??0)+statCard('Banned Users',result.bannedUsers??0)+statCard('Total Receipts',result.receipts??0)+statCard('Receipts Today',result.receiptsToday??0)+statCard('Total Visits',result.visitors??0);
      setStatus('Statistics loaded. Total Visits counts browser-tab sessions recorded, not unique people.');
    }else if(action==='users'){
      $('adminStats').innerHTML='';
      const users=result.users||[];
      if(!users.length){$('adminResults').innerHTML='<p class="muted">No users returned.</p>';setStatus('No users returned.')}
      else usersTable(users);
    }else if(action==='receipts'){
      $('adminStats').innerHTML='';
      const receipts=result.receipts||[];
      receiptsTable(receipts);
      if(!receipts.length) setStatus('No receipts returned.');
    }else if(action==='analytics'){
      $('adminStats').innerHTML='';
      analyticsChart(result.analytics||[]);
      setStatus('Analytics loaded for the last 7 days.');
    }
  }catch(err){
    setStatus('Could not load admin data: '+err.message,true);
    if(action==='stats') $('adminStats').innerHTML=statCard('Registered Users','—')+statCard('Active Users','—')+statCard('Banned Users','—')+statCard('Total Receipts','Error')+statCard('Receipts Today','Error')+statCard('Total Visits','Error');
  }
}

export function initAdmin(){
  qsa('#adminTabs [data-admin]').forEach(b=>b.addEventListener('click',()=>loadAdminData(b.dataset.admin)));
  $('adminRefreshBtn').addEventListener('click',()=>loadAdminData(view));   // refreshes the tab you are on
}
