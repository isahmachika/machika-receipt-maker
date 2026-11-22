import {sb} from './supa.js';
import {$,toast} from './utils.js';
import {state} from './state.js';
import {initRouter,onEnter,render,go} from './router.js';
import {initAuth,setMode} from './auth.js';
import {initEditor,hardResetEditor,applyProfile,loadCloudReceipt,setEditorTab} from './editor.js';
import {initReceipts,loadReceipts,resetReceiptViews} from './receipts.js';
import {initProfile,fillProfileForm} from './profile.js';
import {initTelegram,checkTelegramStatus,stopTelegramPolling} from './telegram.js';
import {initAdmin,loadAdminData} from './admin.js';
import {initLegal} from './legal.js';
import {initLanding} from './landing.js';
import {initCatalog,loadCatalog,resetCatalog} from './catalog.js';
import {updateShellUser,displayName,greeting} from './shell.js';

function boot(){
  if(!sb){
    $('splash').innerHTML='<p style="padding:24px;text-align:center;max-width:360px">Machika Receipt Maker could not load its required libraries. Check your internet connection and reload the page.</p>';
    return;
  }

  initRouter();initAuth();initEditor();initReceipts();initProfile();initTelegram();initAdmin();initLegal();initLanding();initCatalog();

  // Runs only when the page (or sign-in state) changes, never on tab focus.
  onEnter('/login',()=>setMode('login'));
  onEnter('/register',()=>setMode('register'));
  onEnter('/dashboard',()=>{
    $('pageSub').textContent=greeting()+', '+displayName()+'.';
    loadReceipts();
    checkTelegramStatus();
  });
  onEnter('/create-receipt',()=>setEditorTab('edit'));
  onEnter('/my-receipts',()=>{loadReceipts()});
  onEnter('/profile',fillProfileForm);
  onEnter('/account',()=>{
    $('recoveryNotice').hidden=!state.recovery;
    $('passwordStatus').textContent='';
    $('newPassword').value='';$('confirmPassword').value='';
    updateShellUser();
  });
  onEnter('/admin',()=>loadAdminData('stats'));

  // "Open" on a saved receipt: fill the editor, then move to it (the address bar changes too).
  document.addEventListener('receipt:open',e=>{loadCloudReceipt(e.detail);go('/create-receipt')});

  // One visit per browser tab session. This counts visits, not unique people.
  try{
    if(!sessionStorage.getItem('machika_visit_counted')){
      sb.from('site_visits').insert({}).then(({error})=>{if(!error) sessionStorage.setItem('machika_visit_counted','1')});
    }
  }catch(e){console.warn('Visit tracking unavailable',e)}

  let lastUid;   // undefined until the first session check
  function handleSession(event,session){
    const user=session?.user||null,uid=user?.id||null;
    state.user=user;
    const changed=uid!==lastUid;
    lastUid=uid;
    if(event==='PASSWORD_RECOVERY'){state.recovery=true;$('recoveryNotice').hidden=false}
    if(changed){
      // A different person (or nobody): clear everything that belongs to the previous account.
      stopTelegramPolling();
      resetReceiptViews();resetCatalog();
      hardResetEditor();
      if(user){
        applyProfile(true);fillProfileForm();updateShellUser();
        $('authPassword').value='';
        loadReceipts();loadCatalog();
      }
    }else if(event==='USER_UPDATED'&&user){
      fillProfileForm();updateShellUser();
    }
    state.ready=true;
    if(event==='PASSWORD_RECOVERY') go('/account',{replace:true}); else render();
  }

  // Supabase asks not to call its API from inside this callback, so the work is deferred a tick.
  sb.auth.onAuthStateChange((event,session)=>{setTimeout(()=>handleSession(event,session),0)});
  sb.auth.getSession().then(({data,error})=>handleSession('INITIAL',error?null:data.session)).catch(()=>handleSession('INITIAL',null));
}

boot();

// Offline support: lets the website open like an app, even on a weak network.
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('Offline mode unavailable',e))});
}
window.addEventListener('offline',()=>toast('You are offline. You can still create receipts and download them, but saving needs internet.','info',8000));
window.addEventListener('online',()=>toast('Back online.','success',3000));
