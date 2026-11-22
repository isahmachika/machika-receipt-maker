import {$} from './utils.js';

// Small live demo on the landing page: the printed receipt shows the shop name you type.
export function initLanding(){
  const input=$('heroShopInput'),out=$('heroShop');
  if(!input||!out) return;
  input.addEventListener('input',()=>{out.textContent=(input.value.trim()||'Machika Store').toUpperCase()});
}
