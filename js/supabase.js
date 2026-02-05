// Supabase client configuration
// Replace these with your Supabase project credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let supabaseClient = null;

export function getSupabase() {
    if (!supabaseClient) {
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase SDK not loaded. Include the script tag in index.html.');
            return null;
        }
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

export function isConfigured() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}
