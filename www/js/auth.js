import {sb} from './supa.js';
import {$,toast,setBusy} from './utils.js';
import {state} from './state.js';
import {go} from './router.js';

let mode='login';

export function setStatus(msg,isError=false,isOk=false){
  const el=$('authStatus');
  el.textContent=msg;
  el.className='status'+(isError?' error':isOk?' ok':'');
}

export function setMode(m){
  mode=m;
  const login=m==='login';
  $('authHeading').textContent=login?'Login to your account':'Create a new account';
  $('authIntro').textContent=login?'Log in to use the receipt maker.':'Create an account with your email and password to get started.';
  $('authSubmit').textContent=login?'Login':'Create account';
  $('resetBtn').hidden=!login;
  [['loginTab',login],['registerTab',!login]].forEach(([id,on])=>{
    const b=$(id);b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on));
  });
  $('authPassword').autocomplete=login?'current-password':'new-password';
  setStatus('');
}

async function signIn(){
  const email=$('authEmail').value.trim(),password=$('authPassword').value;
  if(!email||!password){setStatus('Enter your email and password.',true);return}
  setStatus('Logging in...');setBusy($('authSubmit'),true);
  const {error}=await sb.auth.signInWithPassword({email,password});
  setBusy($('authSubmit'),false);
  if(error) setStatus(error.message,true);
}

async function signUp(){
  const email=$('authEmail').value.trim(),password=$('authPassword').value;
  if(!email||!password){setStatus('Enter your email and password.',true);return}
  if(password.length<6){setStatus('Password must be at least 6 characters.',true);return}
  setStatus('Creating account...');setBusy($('authSubmit'),true);
  const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});
  setBusy($('authSubmit'),false);
  if(error){setStatus(error.message,true);return}
  if(data.session) setStatus('Your account has been created and you are now signed in.',false,true);
  else setStatus('A confirmation email may have been sent. Check your inbox or spam folder, confirm your email, then log in.',false,true);
}

async function resetPassword(){
  const email=$('authEmail').value.trim();
  if(!email){setStatus('Enter your email first.',true);return}
  setStatus('Sending password reset link...');
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin});
  if(error) setStatus(error.message,true);
  else setStatus('If an account exists for this email, a password reset link will be sent. Check your inbox and spam folder.',false,true);
}

// The reset-link email signs the person in. This is the missing step: let them choose a new password.
async function changePassword(){
  const pw=$('newPassword').value,pw2=$('confirmPassword').value,st=$('passwordStatus');
  const say=(m,err=false,ok=false)=>{st.textContent=m;st.className='status'+(err?' error':ok?' ok':'')};
  if(pw.length<6){say('Password must be at least 6 characters.',true);return}
  if(pw!==pw2){say('The two passwords do not match.',true);return}
  say('Updating password...');setBusy($('changePasswordBtn'),true);
  const {error}=await sb.auth.updateUser({password:pw});
  setBusy($('changePasswordBtn'),false);
  if(error){say(error.message,true);return}
  $('newPassword').value='';$('confirmPassword').value='';
  state.recovery=false;$('recoveryNotice').hidden=true;
  say('Your password has been updated.',false,true);
  toast('Password updated.','success');
}

export async function signOut(){
  const {error}=await sb.auth.signOut();
  if(error) toast(error.message,'error');
  // On success the SIGNED_OUT event updates state and the router sends the person to /login.
}

export function initAuth(){
  $('authForm').addEventListener('submit',e=>{e.preventDefault();mode==='login'?signIn():signUp()});
  $('resetBtn').addEventListener('click',resetPassword);
  $('loginTab').addEventListener('click',()=>go('/login'));
  $('registerTab').addEventListener('click',()=>go('/register'));
  $('passwordForm').addEventListener('submit',e=>{e.preventDefault();changePassword()});
  $('logoutBtn').addEventListener('click',signOut);
  $('accountLogoutBtn').addEventListener('click',signOut);
  $('pwToggle').addEventListener('click',()=>{
    const input=$('authPassword'),show=input.type==='password';
    input.type=show?'text':'password';
    $('pwToggle').setAttribute('aria-pressed',String(show));
    $('pwToggle').setAttribute('aria-label',show?'Hide password':'Show password');
    $('pwToggle').querySelector('use').setAttribute('href',show?'#i-eye-off':'#i-eye');
  });
}
