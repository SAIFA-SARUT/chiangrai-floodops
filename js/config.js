export const APP_CONFIG = {
  supabaseUrl: 'https://kxnohxbipjtzdaoorauh.supabase.co',
  supabaseAnonKey: 'sb_publishable__hOBakAjyIPWEeczvcQZOQ_6p8XRwuT',
  demoMode: false,
  provinceName: 'เชียงราย',
  mapCenter: [19.91, 99.84],
  mapZoom: 9
};

export const isSupabaseConfigured = () => {
  const url = APP_CONFIG.supabaseUrl.trim();
  const key = APP_CONFIG.supabaseAnonKey.trim();

  const validUrl =
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    !url.includes('YOUR_');

  const validKey =
    (key.startsWith('sb_publishable_') && key.length > 20) ||
    (key.startsWith('eyJ') && key.length > 40);

  return validUrl && validKey;
};
