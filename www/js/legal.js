import {$} from './utils.js';

// Privacy Policy and Terms of Service: the text is exactly the one from the original page.
const policies={
 privacy:{title:'Privacy Policy',html:`<p><b>Last updated:</b> October 24, 2026</p>
 <p>Machika Receipt Maker helps users create, save, view, and download business receipts. This policy describes information the website may process when you use these features.</p>
 <h3>1. Information we process</h3><ul><li><b>Account information:</b> your email address and authentication information handled by our authentication provider.</li><li><b>Business and receipt information:</b> business name, phone number, address, receipt number, customer name, items, quantities, prices, discounts, payment method, notes, totals, and receipt dates you enter.</li><li><b>Saved receipt images:</b> when you save a receipt, the website may store a PNG image and related receipt information in your account.</li><li><b>Basic visit records:</b> the website may record a browser-tab visit for site statistics. These records are not necessarily a count of unique people.</li></ul>
 <h3>2. How information is used</h3><p>Information is used to authenticate users, create and display receipts, save receipts to the correct account, provide receipt history, support the website, and understand general site usage.</p>
 <h3>3. Storage and service providers</h3><p>The website uses Supabase for account authentication and online data/storage, and Netlify for website hosting. These providers process information as needed to deliver their services under their own terms and privacy practices.</p>
 <h3>4. Sharing</h3><p>We do not intend to sell your receipt or business information. Information may be processed by service providers that operate the website, or disclosed where required by law or necessary to protect the service and its users.</p>
 <h3>5. Security and account access</h3><p>We use account-based access controls intended to restrict saved receipts to the relevant account. No online service can guarantee absolute security. Keep your password private and sign out on shared devices.</p>
 <h3>6. Retention and deletion</h3><p>Saved information may remain in your account until you delete it or request help. To ask a question about your information or request assistance with deletion, email <a href="mailto:support.machikareceiptmaker@gmail.com">support.machikareceiptmaker@gmail.com</a>.</p>
 <h3>7. Children</h3><p>This service is not designed specifically for children.</p><h3>8. Changes and contact</h3><p>This policy may be updated as the service changes. For privacy questions, contact <a href="mailto:support.machikareceiptmaker@gmail.com">support.machikareceiptmaker@gmail.com</a>.</p>
 <p><i>Note: This is a general policy template. Check it against the website's actual data practices and applicable law before public launch.</i></p>`},
 terms:{title:'Terms of Service',html:`<p><b>Last updated:</b> October 24, 2026</p><p>By accessing or using Machika Receipt Maker, you agree to these terms. If you do not agree, do not use the service.</p>
 <h3>1. What the service does</h3><p>Machika Receipt Maker provides tools to create, save, view, and download receipts as PNG images. Availability and features may change as the service is improved.</p>
 <h3>2. Your account</h3><p>You are responsible for keeping your login details confidential and for activity carried out through your account. Provide accurate account information and contact support if you believe your account has been accessed without permission.</p>
 <h3>3. Accurate and lawful use</h3><p>You are responsible for checking that business names, customer details, items, quantities, prices, discounts, payment methods, dates, and totals are correct. Do not use the service to create deceptive, fraudulent, unlawful, or misleading documents, or to violate another person's rights.</p>
 <h3>4. Your information</h3><p>You are responsible for having permission to enter and store any customer or business information you submit. Do not enter sensitive information that is unnecessary for creating a receipt.</p>
 <h3>5. Storage and availability</h3><p>We aim to keep the service available, but we do not guarantee uninterrupted access or permanent storage. Keep your own business records and copies of important receipts. Some features depend on third-party providers and internet connectivity.</p>
 <h3>6. Intellectual property</h3><p>You are responsible for the content you enter and may use receipts you create for lawful business purposes. Website design and code may be protected by applicable intellectual-property laws.</p>
 <h3>7. Disclaimer</h3><p>The service is provided on an “as available” basis to the extent permitted by law. You are responsible for determining whether receipts meet your business, accounting, tax, and legal requirements.</p>
 <h3>8. Suspension or changes</h3><p>Access may be restricted where necessary to protect the service, users, or comply with law, including in cases of suspected abuse or unlawful use.</p>
 <h3>9. Limits and applicable law</h3><p>To the extent permitted by applicable law, Machika Receipt Maker is not responsible for indirect loss arising from inability to use the service or reliance on inaccurate information entered by a user. These terms do not remove rights that cannot legally be excluded.</p>
 <h3>10. Changes and contact</h3><p>These terms may be updated as the service changes. Questions can be sent to <a href="mailto:support.machikareceiptmaker@gmail.com">support.machikareceiptmaker@gmail.com</a>.</p><p><i>Note: This is a general terms template, not legal advice. Have it reviewed for your business and applicable law before public launch.</i></p>`}
 };

export function initLegal(){
  const dialog=$('legalDialog');
  if(!dialog) return;
  const close=()=>{if(dialog.open) dialog.close()};
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-open-legal]');
    if(!b) return;
    const p=policies[b.dataset.openLegal];
    if(!p) return;
    $('legalTitle').textContent=p.title;
    $('legalContent').innerHTML=p.html;
    if(typeof dialog.showModal==='function') dialog.showModal();
    dialog.scrollTop=0;
  });
  $('legalClose').addEventListener('click',close);
  $('legalDone').addEventListener('click',close);
  // Click on the dimmed backdrop closes it too.
  dialog.addEventListener('click',e=>{if(e.target===dialog) close()});
  const y=String(new Date().getFullYear());
  ['footerYear','appFooterYear'].forEach(id=>{const el=$(id);if(el) el.textContent=y});
}
