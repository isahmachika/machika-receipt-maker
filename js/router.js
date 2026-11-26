import {$,qsa,toast} from './utils.js';
import {state} from './state.js';
import {SUPER_ADMIN_EMAIL} from './config.js';

// Same URLs as before, so old links and bookmarks keep working.
export const PUBLIC=['/','/login','/register'];
export const PROTECTED=['/dashboard','/create-receipt','/my-receipts','/money','/profile','/account','/admin'];

const PAGES={
  '/dashboard':['Dashboard',''],
  '/create-receipt':['Create receipt','Fill in the details and watch the receipt update.'],
  '/my-receipts':['Receipts','Every receipt you have saved.'],
  '/money':['Money','Who owes you, what you spent, and your profit.'],
  '/profile':['Business profile','Your shop details, filled into every new receipt.'],
  '/account':['My account','Manage your signed-in account.'],
  '/admin':['Super admin','']
};
const PUBLIC_TITLES={'/':'Machika Receipt Maker — professional receipts in minutes','/login':'Login · Machika Receipt Maker','/register':'Create account · Machika Receipt Maker'};

const hooks={};
export const onEnter=(path,fn)=>{hooks[path]=fn};

export const isSuperAdmin=()=>!!(state.user?.email&&state.user.email.toLowerCase()===SUPER_ADMIN_EMAIL);

export function currentPath(){
  const p=(location.pathname||'/').replace(/\/+$/,'')||'/';
  return PUBLIC.includes(p)||PROTECTED.includes(p)?p:'/';
}

export function go(path,{replace=false}={}){
  if(replace) history.replaceState({m:1},'',path);
  else if(location.pathname!==path) history.pushState({m:1},'',path);
  render();
}

let lastKey=null;

// Idempotent: safe to call on every auth event or tab focus. Page "enter" hooks only run when the page or sign-in state changes,
// so coming back to the tab never resets what someone is typing.
export function render(){
  if(!state.ready) return;
  const path=currentPath();
  const signed=!!state.user;

  if(!signed&&PROTECTED.includes(path)) return go('/login',{replace:true});
  if(signed&&PUBLIC.includes(path)) return go('/dashboard',{replace:true});
  if(path==='/admin'&&!isSuperAdmin()){
    toast('You do not have permission to access Super Admin.','error');
    return go('/dashboard',{replace:true});
  }

  const isApp=PROTECTED.includes(path);
  $('splash').hidden=true;
  $('landingView').hidden=path!=='/';
  $('authView').hidden=!(path==='/login'||path==='/register');
  $('appShell').hidden=!isApp;

  if(isApp){
    qsa('.page').forEach(p=>{p.hidden=p.id!=='page-'+path.slice(1)});
    qsa('[data-nav]').forEach(a=>{
      const on=a.dataset.nav===path;
      a.classList.toggle('active',on);
      if(on) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
    });
    const admin=isSuperAdmin();   // the admin entry is in the side menu (desktop), the top bar and the Account page (phones)
    $('navAdmin').hidden=!admin;$('topAdmin').hidden=!admin;$('adminCard').hidden=!admin;
    $('appShell').dataset.page=path.slice(1);
    $('pageTitle').textContent=PAGES[path][0];
    $('pageSub').textContent=PAGES[path][1];
    document.title=PAGES[path][0]+' · Machika Receipt Maker';
  }else{
    document.title=PUBLIC_TITLES[path];
  }
  const canon=document.querySelector('link[rel="canonical"]');
  if(canon) canon.href=location.origin+(isApp?'/':path);

  const key=path+'|'+signed;
  if(key!==lastKey){
    const first=lastKey===null;
    lastKey=key;
    window.scrollTo(0,0);
    if(hooks[path]) hooks[path](path);
    if(isApp&&!first) $('view').focus({preventScroll:true});
  }
}

export function initRouter(){
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[data-route]');
    if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    e.preventDefault();
    go(a.dataset.route);
  });
  window.addEventListener('popstate',render);
}
