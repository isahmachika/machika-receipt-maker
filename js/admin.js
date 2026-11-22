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

function usersTable(users){
  $('adminResults').innerHTML=
    '<div class="admin-search"><label for="adminUserSearch">Search users by email</label><input id="adminUserSearch" type="search" placeholder="Type an email to search..." autocomplete="off"></div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Registered</th><th>Last sign-in</th><th>Status</th><th>Action</th></tr></thead><tbody id="adminUsersBody"></tbody></table></div>';
  const renderUsers=(query='')=>{
    const q=query.trim().toLowerCase();
    const filtered=users.filter(u=>(u.email||'').toLowerCase().includes(q));
    $('adminUsersBody').innerHTML=filtered.map(u=>{
      const banned=!!(u.banned_until&&new Date(u.banned_until).getTime()>Date.now());
      const action=banned?'unban-user':'ban-user';
      return '<tr><td class="break">'+safe(u.email||'—')+'</td><td>'+safe(when(u.created_at))+'</td><td>'+safe(u.last_sign_in_at?when(u.last_sign_in_at):'Never')+'</td>'+
        '<td><span class="pill '+(banned?'bad':'ok')+'">'+(banned?'Banned':'Active')+'</span></td>'+
        '<td><button type="button" class="btn '+(banned?'btn-unban':'btn-ban')+'" data-user-action="'+action+'" data-user-id="'+safe(u.id||'')+'">'+(banned?'Unban':'Ban')+'</button></td></tr>';
    }).join('')||'<tr><td colspan="5">No users match that search.</td></tr>';
    setStatus('Showing '+filtered.length+' of '+users.length+' users (maximum 100 per request). Admin accounts and your own account are protected.');
  };
  $('adminUserSearch').addEventListener('input',e=>renderUsers(e.target.value));
  $('adminUsersBody').addEventListener('click',async e=>{
    const b=e.target.closest('button[data-user-action]');
    if(b) await adminUserAction(b.dataset.userAction,b.dataset.userId);
  });
  renderUsers();
}

function receiptsTable(receipts){
  $('adminResults').innerHTML=receipts.length
    ?'<div class="table-wrap"><table class="table"><thead><tr><th>Receipt</th><th>Business</th><th>Customer</th><th class="r">Total</th><th>Created</th></tr></thead><tbody>'+
      receipts.map(r=>'<tr><td class="mono break">'+safe(r.receipt_number||'—')+'</td><td>'+safe(r.business_name||'—')+'</td><td>'+safe(r.customer_name||'—')+'</td><td class="r mono">₦'+money(r.total)+'</td><td>'+safe(when(r.created_at))+'</td></tr>').join('')+
      '</tbody></table></div>'
    :'<p class="muted">No receipts returned.</p>';
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
      setStatus('Showing '+receipts.length+' recent receipts (maximum 100).');
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
