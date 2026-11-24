// Single shared state object for the whole app.
export const state={
  user:null,            // current Supabase user, or null when signed out
  ready:false,          // true once the first session check has finished
  receipts:[],
  report:null,          // date + total of all receipts (for sales figures and the report)          // latest saved receipts of the signed-in user
  receiptsLoaded:false,
  receiptsAt:0,
  recovery:false        // true after the user opens a password-reset link
};

// Business details saved in the account (user_metadata), used to pre-fill new receipts.
export function profileOf(user){
  const m=user?.user_metadata||{};
  return {business:m.business_name||'',phone:m.business_phone||'',address:m.business_address||''};
}
