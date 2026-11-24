import {sb} from './supa.js';
import {$,toast,copyText,confirmAction} from './utils.js';
import {state} from './state.js';
import {currentPath} from './router.js';

let pollTimer=null;
const resultOpen=()=>!$('telegramLinkResult').hidden;

function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
function startPolling(){
  stopPolling();
  let ticks=0;
  // Quiet check while a link code is on screen, so the instructions are not wiped every few seconds.
  pollTimer=setInterval(()=>{
    if(!state.user||!resultOpen()||++ticks>130){stopPolling();return}
    checkTelegramStatus({silent:true});
  },5000);
}
export const stopTelegramPolling=stopPolling;

// The evening-summary switch only shows while Telegram is connected.
function showSummary(on,checked=false){
  const row=$('telegramSummaryRow'),box=$('telegramSummary');
  if(!row||!box) return;
  row.hidden=!on;
  if(on&&!box.disabled) box.checked=checked;
}

async function changeSummary(){
  const box=$('telegramSummary'),want=box.checked;
  box.disabled=true;
  try{
    const {data,error}=await sb.functions.invoke('machika-telegram-link',{body:{action:'summary',enabled:want}});
    if(error){
      let why='';
      try{why=(await error.context?.json?.())?.error||''}catch{}
      throw new Error(why||error.message||'Could not change the evening summary.');
    }
    if(!data||data.success!==true) throw new Error(data?.error||'Could not change the evening summary.');
    box.checked=data.daily_summary===true;
    toast(box.checked?'Evening summary is on. Look out for it around 8 pm.':'Evening summary is off.','success');
  }catch(err){
    console.error('Telegram summary switch error:',err);
    box.checked=!want;   // put the switch back to what is really saved
    toast(String(err?.message||'Could not change the evening summary. Please try again.').slice(0,160),'error');
  }finally{box.disabled=false}
}

export async function checkTelegramStatus({silent=false}={}){
  const status=$('telegramConnectStatus'),gen=$('telegramConnectBtn'),dis=$('telegramDisconnectBtn'),pill=$('telegramPill');
  if(!status||!gen||!dis) return;
  if(!state.user){
    status.textContent='Please sign in to check your Telegram connection.';
    gen.hidden=false;dis.hidden=true;pill.hidden=true;showSummary(false);
    return;
  }
  if(!silent) status.textContent='Checking Telegram connection...';
  try{
    const {data,error}=await sb.functions.invoke('machika-telegram-link',{body:{action:'status'}});
    if(error) throw error;
    if(!data||data.success!==true) throw new Error(data?.error||'Status check failed.');
    if(data.connected){
      status.textContent='Telegram is connected to your Machika account.';
      gen.hidden=true;dis.hidden=false;pill.hidden=false;
      showSummary(true,data.daily_summary===true);
      $('telegramLinkResult').hidden=true;
      stopPolling();
    }else{
      if(!silent) status.textContent='Telegram is not connected yet.';
      gen.hidden=false;dis.hidden=true;pill.hidden=true;showSummary(false);
    }
  }catch(err){
    console.error('Telegram status error:',err);
    if(!silent){
      const why=String(err?.message||'').slice(0,120);
      status.textContent='Could not check your Telegram connection'+(why?' ('+why+')':'')+'. Check your internet, then refresh the page.';
      gen.hidden=false;dis.hidden=true;pill.hidden=true;showSummary(false);
    }
  }
}

async function disconnectTelegram(){
  const btn=$('telegramDisconnectBtn');
  if(!state.user) return;
  const ok=await confirmAction({title:'Disconnect Telegram?',text:'Disconnect your Telegram account from Machika Receipt Maker?',okText:'Disconnect',danger:true});
  if(!ok) return;
  btn.disabled=true;
  $('telegramConnectStatus').textContent='Disconnecting Telegram...';
  try{
    const {data,error}=await sb.functions.invoke('machika-telegram-link',{body:{action:'disconnect'}});
    if(error) throw error;
    if(!data||data.success!==true) throw new Error(data?.error||'Disconnect failed.');
    $('telegramLinkResult').hidden=true;
    await checkTelegramStatus();
  }catch(err){
    console.error('Telegram disconnect error:',err);
    $('telegramConnectStatus').textContent='Could not disconnect Telegram. Please try again.';
  }finally{btn.disabled=false}
}

async function generateTelegramLinkCode(){
  const status=$('telegramConnectStatus'),result=$('telegramLinkResult'),btn=$('telegramConnectBtn');
  result.hidden=true;
  if(!state.user){status.textContent='Please sign in to your Machika account first.';return}
  btn.disabled=true;
  status.textContent='Generating a secure one-time link code...';
  try{
    const {data,error}=await sb.functions.invoke('machika-telegram-link',{body:{action:'generate'}});
    if(error) throw error;
    if(!data||!data.code) throw new Error(data?.error||'The linking service did not return a code.');
    $('telegramLinkCode').textContent=data.code;
    $('telegramStartCommand').textContent='/link '+data.code;
    const botUsername=(data.bot_username||'MachikaReceiptBot').replace(/^@/,'');
    const botLink=$('telegramOpenBot');
    if(botUsername){botLink.href='https://t.me/'+encodeURIComponent(botUsername);botLink.hidden=false}
    else botLink.hidden=true;
    result.hidden=false;
    status.textContent='Link code generated. It expires in '+(data.expires_in_minutes||10)+' minutes. Open the bot and send the command shown below to finish linking.';
    startPolling();
  }catch(err){
    console.error('Telegram link code error:',err);
    status.textContent=err?.message||'Could not generate a Telegram link code. Please try again.';
  }finally{btn.disabled=false}
}

export function initTelegram(){
  $('telegramConnectBtn').addEventListener('click',generateTelegramLinkCode);
  $('telegramDisconnectBtn').addEventListener('click',disconnectTelegram);
  $('telegramSummary').addEventListener('change',changeSummary);
  $('copyCommandBtn').addEventListener('click',async()=>{
    const ok=await copyText($('telegramStartCommand').textContent);
    toast(ok?'Command copied.':'Could not copy. Select the command and copy it manually.',ok?'success':'error');
  });
  // Coming back from the Telegram app: re-check once.
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&state.user&&currentPath()==='/dashboard') checkTelegramStatus({silent:resultOpen()});
  });
}
