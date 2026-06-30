import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Please configure .env file.');
}

/**
 * Resilient auth lock.
 *
 * supabase-js calls auth.getSession() before EVERY request to attach the access
 * token, and getSession() acquires an exclusive Web Locks (Navigator LockManager)
 * lock. If that lock is ever held or contended - a stuck/slow token refresh, an
 * extra or backgrounded tab, or browser LockManager quirks - every query blocks on
 * it. With the default 10s acquire timeout this made pages hang for seconds-to-
 * minutes. This wrapper waits only briefly for the lock and, if it can't be
 * obtained promptly, runs the operation anyway (best-effort) instead of blocking
 * the UI. Under normal single-tab use the lock is free and acquired instantly, so
 * behaviour is unchanged; the bypass only kicks in during the pathological cases.
 */
const LOCK_WAIT_MS = 5000;
const resilientNavigatorLock = async (name, _acquireTimeout, fn) => {
  if (typeof navigator === 'undefined' || !navigator.locks || !navigator.locks.request) {
    return await fn();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOCK_WAIT_MS);

  try {
    return await navigator.locks.request(
      name,
      { mode: 'exclusive', signal: controller.signal },
      async () => await fn()
    );
  } catch (error) {
    if (error && error.name === 'AbortError') {
      // Couldn't acquire the lock in time - proceed without it rather than hang.
      console.warn(`Supabase auth lock "${name}" unavailable after ${LOCK_WAIT_MS}ms; proceeding without it.`);
      return await fn();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * fetch wrapper with a hard timeout. The browser's fetch never times out on its
 * own, so a stalled request (e.g. a token refresh) can hold the auth lock - and
 * therefore every query - indefinitely. Aborting after REQUEST_TIMEOUT_MS turns
 * an indefinite hang into a normal, recoverable error.
 */
const REQUEST_TIMEOUT_MS = 20000;
const fetchWithTimeout = (input, init = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const signal = init.signal
    ? (init.signal.aborted
        ? init.signal
        : (init.signal.addEventListener('abort', () => controller.abort()), controller.signal))
    : controller.signal;
  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timeoutId));
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: resilientNavigatorLock,
      storage: {
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
      fetch: fetchWithTimeout,
      headers: {
        'X-Client-Info': 'zone-d-landlord-app/1.0'
      }
    }
  }
);

export default supabase;

