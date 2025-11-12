// js/supabaseClient.js

// Replace with your actual Supabase Project URL and Public Key
const SUPABASE_URL = 'https://ntzrktebhyexfwngdaso.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50enJrdGViaHlleGZ3bmdkYXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MzQ0NTksImV4cCI6MjA3ODUxMDQ1OX0.izk8vZcEokHyvHeJpSA11rTxN1ga4KEW1jSv-IhFWQ8'; 

// 1. Call the .createClient() method from the global 'supabase' object (from the CDN)
// 2. Store the resulting client in a new variable, e.g., 'supabaseClient'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Make this new client globally available for auth.js and others to use.
// We'll name it 'supabase' in the global window scope.
window.supabase = supabaseClient;