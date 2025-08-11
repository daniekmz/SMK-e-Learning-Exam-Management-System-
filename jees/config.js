// config.js
const supabaseUrl = ''; // Ganti dengan URL project Anda
const supabaseKey = ''; // Ganti dengan anon key Anda

window.supabase = supabase.createClient(supabaseUrl, supabaseKey, {
  db: { 
    schema: 'public'
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    flowType: 'implicit'
  },
  global: {
    headers: {
      'X-Client-Info': 'smk-veteran-file-manager',
      'Authorization': `Bearer ${supabaseKey}`
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
});

window.supabaseConfig = {
  bypassAuth: true,
  allowAnonymous: true
};