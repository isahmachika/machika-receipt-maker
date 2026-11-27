import {sb} from './supa.js';
import {$,safe,fmtDate,icon} from './utils.js';
import {state} from './state.js';

// News from the admin: shown at the top of the dashboard and in the notification bell.
const SHOW_DAYS=30,MAX_SHOWN=3;
const key=()=>'machika-news-x-'+(state.user?.id||'');
const readGone=()=>{try{return new Set(JSON.parse(localStorage.getItem(key())||'[]'))}catch{return new Set()}};
const writeGone=ids=>{try{localStorage.setItem(key(),JSON.stringify([...ids].slice(-80)))}catch{/* ignore */}};
const fresh=a=>Date.now()-new Date(a.created_at).getTime()<SHOW_DAYS*864e5;

let lastLoad=0;

export const recentNews=()=>state.news.filter(fresh);

export async function loadNews({force=false}={}){
  if(!state.user) return;
  if(!force&&Date.now()-lastLoad<60000) return;
  const uid=state.user.id;
  lastLoad=Date.now();
  const {data,error}=await sb.from('announcements').select('id,title,body,created_at').order('created_at',{ascending:false}).limit(20);
  if(state.user?.id!==uid) return;
  if(error){console.warn('News could not load',error);return}
  state.news=data||[];
  draw();
  document.dispatchEvent(new Event('notify:refresh'));
}

export function resetNews(){state.news=[];lastLoad=0;draw()}

function draw(){
  const host=$('newsList');
  if(!host) return;
  const gone=readGone();
  const list=recentNews().filter(a=>!gone.has(a.id)).slice(0,MAX_SHOWN);
  host.innerHTML=list.map(a=>`<article class="news"><div><b>${safe(a.title)}</b><p>${safe(a.body)}</p><small>${safe(fmtDate(a.created_at))}</small></div><button type="button" data-news-x="${safe(a.id)}" aria-label="Dismiss this news">${icon('x')}</button></article>`).join('');
}

export function initNews(){
  const host=$('newsList');
  if(!host) return;
  host.addEventListener('click',e=>{
    const b=e.target.closest('[data-news-x]');
    if(!b) return;
    const gone=readGone();gone.add(b.dataset.newsX);writeGone(gone);draw();
  });
  // Coming back to the tab: pick up anything new (at most once a minute).
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) loadNews()});
}
