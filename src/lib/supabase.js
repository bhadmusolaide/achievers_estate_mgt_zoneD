import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Please configure .env file.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      localStorage: {
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch (error) {
            console.warn('Error reading from localStorage:', error);
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch (error) {
            console.warn('Error writing to localStorage:', error);
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.warn('Error removing from localStorage:', error);
          }
        }
      }
    },
    global: {
      headers: {
        'X-Client-Info': 'zone-d-landlord-app/1.0'
      }
    }
  }
);

export default supabase;

