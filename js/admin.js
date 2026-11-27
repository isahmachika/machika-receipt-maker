import {sb} from './supa.js';
import {loadNews} from './news.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';
import {$,qsa,safe,money,toast,confirmAction,downloadCsv} from './utils.js';

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
    setStatus('Showing '+shown.length+' of '+users.length+' users. Admin accounts and your own account are protected.');
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
    setStatus('Showing '+shown.length+' of '+receipts.length+' receipts. Total of shown: ₦'+money(sum)+'.');
  };
  $('adminReceiptSearch').addEventListener('input',render);
  $('adminReceiptSort').addEventListener('change',render);
  $('adminReceiptsCsv').addEventListener('click',()=>{
    downloadCsv('machika-receipts-'+today()+'.csv',['Receipt','Business','Customer','Total','Created'],shown.map(r=>[r.receipt_number||'',r.business_name||'',r.customer_name||'',Number(r.total)||0,r.created_at||'']));
    toast('Downloaded '+shown.length+' receipts.','success');
  });
  render();
}

const KIND_LABEL={idea:'Idea',problem:'Problem',other:'Other'};

function feedbackList(items){
  $('adminResults').innerHTML=
    '<div class="admin-tools">'+
     '<div class="admin-search"><label for="adminFeedbackSearch">Search feedback</label><input id="adminFeedbackSearch" type="search" placeholder="Words or email..." autocomplete="off"></div>'+
     '<div class="admin-search"><label for="adminFeedbackKind">Show</label><select class="input" id="adminFeedbackKind"><option value="all">All messages</option><option value="idea">Ideas</option><option value="problem">Problems</option><option value="other">Other</option></select></div>'+
     '<button type="button" class="btn btn-sm" id="adminFeedbackCsv">Download CSV</button>'+
    '</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Type</th><th>From</th><th>Message</th></tr></thead><tbody id="adminFeedbackBody"></tbody></table></div>';
  let shown=items;
  const render=()=>{
    const q=$('adminFeedbackSearch').value.trim().toLowerCase(),k=$('adminFeedbackKind').value;
    shown=items.filter(f=>(k==='all'||f.kind===k)&&[f.message,f.email].some(v=>String(v||'').toLowerCase().includes(q)));
    $('adminFeedbackBody').innerHTML=shown.map(f=>'<tr><td>'+safe(when(f.created_at))+'</td><td><span class="pill'+(f.kind==='problem'?' bad':'')+'">'+safe(KIND_LABEL[f.kind]||f.kind||'—')+'</span></td><td class="break">'+safe(f.email||'—')+'</td><td class="msg">'+safe(f.message||'')+'</td></tr>').join('')||'<tr><td colspan="4">No messages match.</td></tr>';
    setStatus('Showing '+shown.length+' of '+items.length+' messages (newest first, up to the latest 300).');
  };
  $('adminFeedbackSearch').addEventListener('input',render);
  $('adminFeedbackKind').addEventListener('change',render);
  $('adminFeedbackCsv').addEventListener('click',()=>{
    downloadCsv('machika-feedback-'+today()+'.csv',['When','Type','From','Message'],shown.map(f=>[f.created_at||'',KIND_LABEL[f.kind]||f.kind||'',f.email||'',f.message||'']));
    toast('Downloaded '+shown.length+' messages.','success');
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


/* ---------- Announcements: shown on every dashboard and bell, and optionally sent through the Telegram bot ---------- */
const BOT_URL=SUPABASE_URL+'/functions/v1/rapid-handler';

async function broadcastToTelegram(id){
  const {data,error}=await sb.auth.getSession();
  if(error||!data.session) throw new Error('Please log in again.');
  const response=await fetch(BOT_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+data.session.access_token},
    body:JSON.stringify({action:'broadcast',id})
  });
  let result={};
  try{result=await response.json()}catch{}
  if(!response.ok||!result.ok) throw new Error(result.error||('The Telegram bot did not accept it ('+response.status+').'));
  return result;
}

const tgMessage=r=>`Sent to ${r.sent} Telegram chat${r.sent===1?'':'s'}`+(r.failed?` (${r.failed} could not be reached)`:'')+'.';

async function announceList(){
  const host=$('annList');
  if(!host) return;
  const {data,error}=await sb.from('announcements').select('id,title,body,created_at,telegram_sent_at,telegram_count').order('created_at',{ascending:false}).limit(50);
  if(error){host.innerHTML='<p class="muted">Could not load announcements: '+safe(error.message)+'</p>';return}
  host.innerHTML=(data||[]).length?data.map(a=>
    '<div class="ann-item"><b>'+safe(a.title)+'</b><p>'+safe(a.body)+'</p>'+
    '<div class="ann-meta">'+safe(when(a.created_at))+' · '+(a.telegram_sent_at?'Sent to '+safe(String(a.telegram_count??0))+' Telegram chat'+((a.telegram_count??0)===1?'':'s'):'Not sent to Telegram')+'</div>'+
    '<div class="ann-btns">'+(a.telegram_sent_at?'':'<button type="button" class="btn btn-sm" data-ann-tg="'+safe(a.id)+'">Send to Telegram</button>')+
    '<button type="button" class="btn btn-sm btn-ban" data-ann-del="'+safe(a.id)+'">Delete</button></div></div>').join('')
    :'<p class="muted">No announcements yet.</p>';
}

function renderAnnounce(){
  $('adminResults').innerHTML=
    '<form id="annForm" class="ann-form panel" novalidate>'+
     '<h3>New announcement</h3>'+
     '<div class="field"><label for="annTitle">Title</label><input class="input" id="annTitle" maxlength="120" placeholder="For example: New feature: Money page" autocomplete="off"></div>'+
     '<div class="field"><label for="annBody">Message</label><textarea class="input" id="annBody" maxlength="1500" placeholder="Write what you want every user to know."></textarea></div>'+
     '<label class="ann-check"><input type="checkbox" id="annTg" checked><span>Also send it to users who connected Telegram</span></label>'+
     '<button class="btn btn-primary" id="annSend" type="submit">Publish announcement</button>'+
    '</form>'+
    '<h3>Published</h3><div id="annList"><p class="muted">Loading...</p></div>';
  setStatus('Announcements appear on every user\'s dashboard and in their bell. You can also send them with /announce in your Telegram bot.');
  $('annForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const title=$('annTitle').value.trim(),body=$('annBody').value.trim(),tg=$('annTg').checked;
    if(!title){toast('Write a title.','error');$('annTitle').focus();return}
    if(!body){toast('Write the message.','error');$('annBody').focus();return}
    const btn=$('annSend');btn.disabled=true;
    try{
      const {data,error}=await sb.from('announcements').insert({title,body}).select('id').single();
      if(error||!data) throw new Error(error?.message||'Could not publish.');
      $('annTitle').value='';$('annBody').value='';
      let note='Published. Every user will see it on their dashboard.';
      if(tg){
        try{note='Published. '+tgMessage(await broadcastToTelegram(data.id))}
        catch(err){toast('Published on the website, but Telegram failed: '+err.message,'error',9000);note=''}
      }
      if(note) toast(note,'success',7000);
      loadNews({force:true});
    }catch(err){toast('Could not publish: '+err.message,'error')}
    finally{btn.disabled=false;announceList()}
  });
  $('annList').addEventListener('click',async e=>{
    const send=e.target.closest('[data-ann-tg]'),del=e.target.closest('[data-ann-del]');
    if(send){
      send.disabled=true;
      try{toast(tgMessage(await broadcastToTelegram(send.dataset.annTg)),'success',7000)}
      catch(err){toast('Telegram failed: '+err.message,'error',9000)}
      announceList();
    }else if(del){
      if(!await confirmAction({title:'Delete this announcement?',text:'Users will no longer see it. Messages already sent in Telegram stay there.',okText:'Delete',danger:true})) return;
      const {error}=await sb.from('announcements').delete().eq('id',del.dataset.annDel);
      if(error){toast('Could not delete: '+error.message,'error');return}
      toast('Deleted.','success');loadNews({force:true});announceList();
    }
  });
  announceList();
}

export async function loadAdminData(action=view){
  view=action;
  setActiveTab(action);
  setStatus('Loading admin data...');
  $('adminResults').innerHTML='';
  if(action==='stats') $('adminStats').innerHTML='';
  if(action==='announce'){$('adminStats').innerHTML='';renderAnnounce();return}
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
    }else if(action==='feedback'){
      $('adminStats').innerHTML='';
      const items=result.feedback||[];
      if(!items.length){$('adminResults').innerHTML='<p class="muted">No feedback yet. Messages sent from the Account page show here.</p>';setStatus('No feedback yet.')}
      else feedbackList(items);
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
