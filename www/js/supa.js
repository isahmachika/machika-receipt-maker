import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

// `window.supabase` comes from the CDN script in index.html. It is missing only when the CDN could not load.
export const sb=window.supabase?window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY):null;
