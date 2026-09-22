export const APP_CONFIG = {
  supabaseUrl: 'https://kxnohxbipjtzdaoorauh.supabase.co',
  supabaseAnonKey: 'sb_publishable__hOBakAjyIPWEeczvcQZOQ_6p8XRwuT',
  demoMode: false,
  provinceName: 'เชียงราย',
  mapCenter: [19.91, 99.84],
  mapZoom: 9
};

export const isSupabaseConfigured = () =>
  APP_CONFIG.supabaseUrl.startsWith('https://') &&
  !APP_CONFIG.supabaseUrl.includes('YOUR_') &&
  APP_CONFIG.supabaseAnonKey.length > 40 &&
  !APP_CONFIG.supabaseAnonKey.includes('YOUR_');

  

