// Supabase client configuration
import { config } from './config.js';

// Uses /api prefix - proxied by server.py (local) or nginx (production)
const SUPABASE_URL = window.location.origin + '/api';
const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;

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
