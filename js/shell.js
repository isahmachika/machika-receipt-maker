import {$} from './utils.js';
import {state,profileOf} from './state.js';

export function displayName(){
  const p=profileOf(state.user);
  return p.business||(state.user?.email||'').split('@')[0]||'Your account';
}

export function greeting(){
  const h=new Date().getHours();
  return h<12?'Good morning':h<18?'Good afternoon':'Good evening';
}

// Refreshes everything in the shell that shows who is signed in.
export function updateShellUser(){
  const u=state.user;
  const name=displayName();
  const initial=(name.trim()[0]||'M').toUpperCase();
  $('sideName').textContent=name;
  $('sideEmail').textContent=u?.email||'';
  ['sideAvatar','topAvatar','accAvatar'].forEach(id=>{const el=$(id);if(el)el.textContent=initial});
  $('myAccountEmail').textContent=u?.email||'';
  const p=profileOf(u);
  $('profileTip').hidden=!u||!!(p.business&&p.phone&&p.address);
}
