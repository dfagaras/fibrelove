// ==========================================
// Supabase Configuration
// ==========================================

const SUPABASE_URL = 'https://tndhbyvwkxbulodbadqj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZGhieXZ3a3hidWxvZGJhZHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MjI3NTIsImV4cCI6MjA4MzI5ODc1Mn0.rdWG7dKDutxhp-kQnnA_Gr7r6Hac9I6x558QCJvHA2w';

// Initialize Supabase client
let supabaseClient = null;

try {
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully');
  } else {
    throw new Error('Supabase library not found on window object');
  }
} catch (e) {
  console.error('Failed to initialize Supabase:', e);
  alert('Failed to load app. Please refresh the page.');
}

// ==========================================
// Auth Functions
// ==========================================

async function signUp(email, password, name) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { name }  // This gets passed to our trigger!
    }
  });
  
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

// ==========================================
// Profile Functions
// ==========================================

async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
}

async function updateProfile(userId, updates) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ==========================================
// Shopping List Functions
// ==========================================

async function getShoppingList(userId, weekStart) {
  const { data, error } = await supabaseClient
    .from('shopping_lists')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

async function saveShoppingList(userId, weekStart, items) {
  const { data, error } = await supabaseClient
    .from('shopping_lists')
    .upsert({
      user_id: userId,
      week_start: weekStart,
      items: items
    }, {
      onConflict: 'user_id,week_start'
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ==========================================
// Daily Log Functions
// ==========================================

async function getDailyLog(userId, logDate) {
  const { data, error } = await supabaseClient
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function saveDailyLog(userId, logDate, foods, totalFiber) {
  const { data, error } = await supabaseClient
    .from('daily_logs')
    .upsert({
      user_id: userId,
      log_date: logDate,
      foods: foods,
      total_fiber: totalFiber
    }, {
      onConflict: 'user_id,log_date'
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

async function getWeeklyLogs(userId, weekStart) {
  // Get logs for 7 days starting from weekStart
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  const { data, error } = await supabaseClient
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('log_date', weekStart)
    .lte('log_date', endDate.toISOString().split('T')[0]);
  
  if (error) throw error;
  return data || [];
}

// ==========================================
// Auth State Listener
// ==========================================

function onAuthStateChange(callback) {
  return supabaseClient.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// Make functions available globally
window.supabaseDb = supabaseClient;
window.auth = { signUp, signIn, signOut, getCurrentUser, getSession, onAuthStateChange };
window.db = { getProfile, updateProfile, getShoppingList, saveShoppingList, getDailyLog, saveDailyLog, getWeeklyLogs };

