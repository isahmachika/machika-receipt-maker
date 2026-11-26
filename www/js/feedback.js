import {sb} from './supa.js';
import {SITE_URL} from './config.js';
import {$,toast,copyText,setBusy} from './utils.js';
import {state} from './state.js';

// Invite a friend (WhatsApp) and the feedback form.
const INVITE=`I use Machika Receipt Maker to make receipts, invoices and quotations for my business, and to see who still owes me. Try it here: ${SITE_URL}`;
const MAX=1000;
let lastSent=0;

function invite(){
  window.open('https://wa.me/?text='+encodeURIComponent(INVITE),'_blank','noopener');
}

async function copyInvite(){
  const ok=await copyText(SITE_URL);
  toast(ok?'Link copied. Paste it in a message to your friend.':'Could not copy. The link is '+SITE_URL,ok?'success':'error');
}

function count(){
  $('feedbackCount').textContent=$('feedbackMessage').value.length+' of '+MAX+' characters';
}

async function sendFeedback(e){
  e.preventDefault();
  if(!state.user) return;
  const message=$('feedbackMessage').value.trim(),kind=$('feedbackKind').value;
  if(message.length<3){toast('Write a few words so we understand.','error');$('feedbackMessage').focus();return}
  if(Date.now()-lastSent<15000){toast('Please wait a few seconds before you send another message.','info');return}
  const btn=$('feedbackSend');
  setBusy(btn,true,'Sending...');
  const {error}=await sb.from('feedback').insert({kind,message:message.slice(0,MAX),email:state.user.email||null});
  setBusy(btn,false);
  if(error){
    console.warn('Feedback could not be sent',error);
    toast('Could not send your message. Check your internet and try again.','error');
    return;
  }
  lastSent=Date.now();
  $('feedbackMessage').value='';count();
  toast('Thank you! Your message was sent.','success');
}

export function resetFeedback(){
  $('feedbackMessage').value='';$('feedbackKind').value='idea';count();lastSent=0;
}

export function initFeedback(){
  $('inviteWhatsapp').addEventListener('click',invite);
  $('inviteCopy').addEventListener('click',copyInvite);
  $('feedbackForm').addEventListener('submit',sendFeedback);
  $('feedbackMessage').addEventListener('input',count);
}
