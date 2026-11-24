import {sb} from './supa.js';
import {$,toast,setBusy} from './utils.js';
import {state,profileOf} from './state.js';
import {applyProfile} from './editor.js';
import {updateShellUser} from './shell.js';

export function fillProfileForm(){
  const p=profileOf(state.user);
  $('profileBusiness').value=p.business;
  $('profilePhone').value=p.phone;
  $('profileAddress').value=p.address;
}

function say(msg,err=false,ok=false){const el=$('profileStatus');el.textContent=msg;el.className='status'+(err?' error':ok?' ok':'')}

async function saveProfile(){
  if(!state.user) return;
  const meta={...(state.user.user_metadata||{}),business_name:$('profileBusiness').value.trim(),business_phone:$('profilePhone').value.trim(),business_address:$('profileAddress').value.trim()};
  say('Saving profile...');setBusy($('saveProfileBtn'),true);
  const {data,error}=await sb.auth.updateUser({data:meta});
  setBusy($('saveProfileBtn'),false);
  if(error){say('Could not save: '+error.message,true);return}
  state.user=data.user;
  say('Business profile saved to your account.',false,true);
  toast('Business profile saved.','success');
  applyProfile(true);   // new receipts start with the details that were just saved
  updateShellUser();
}

export function initProfile(){
  $('profileForm').addEventListener('submit',e=>{e.preventDefault();saveProfile()});
}
