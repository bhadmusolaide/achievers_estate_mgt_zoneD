import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession(); 
        if (error) {
          console.error('Error getting session:', error);
          setUser(null);
          setAdminProfile(null);
          setLoading(false);
          return;
        }
        
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchAdminProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setUser(null);
        setAdminProfile(null);
        setProfileError('Authentication error occurred. Please log in again.');
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (event === 'SIGNED_OUT' || event === 'PASSWORD_CHANGE' || event === 'TOKEN_INVALIDATED' || !session) {
          // Clear all auth state
          setUser(null);
          setAdminProfile(null);
          setProfileError(null);
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const sessionUserId = session?.user?.id;
          const currentUserID = user?.id;
          
          // Only update user state if different user or if no user was set before
          if (sessionUserId !== currentUserID) {
            setUser(session?.user ?? null);
          }
          if (session?.user) {
            try {
              await fetchAdminProfile(session.user.id);
            } catch (error) {
              console.error('Error fetching profile after auth change:', error);
              setProfileError('Failed to load user profile. Please log in again.');
            }
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []); // Keep empty dependency array to subscribe only once


  const fetchAdminProfile = async (userId) => {
    try {
      setProfileError(null);
      console.log('Fetching admin profile for:', userId);

      // Fetch admin profile with Supabase's built-in timeout handling
      const { data, error, status } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error on no rows

      console.log('Profile query result:', { data, error, status });

      if (error) {
        console.error('Profile fetch error:', error);
        setProfileError(error.message || 'Failed to fetch profile');
        setAdminProfile(null);
      } else if (!data) {
        console.warn('No admin profile found for user:', userId);
        setProfileError('No admin profile found. Please contact your administrator to set up your profile.');
        setAdminProfile(null);
      } else {
        console.log('Admin profile loaded:', data);
        setAdminProfile(data);
        setProfileError(null);
      }
    } catch (err) {
      console.error('Profile fetch failed:', err);
      // Check if it's a timeout error
      if (err.name === 'AbortError' || err.message.includes('timeout')) {
        setProfileError('Query timeout: Request took too long');
      } else {
        setProfileError(err.message || 'Failed to fetch profile');
      }
      setAdminProfile(null);
    } finally {
      // Only set loading to false on initial load, not on subsequent profile updates
      // We can check if this is the first load by seeing if adminProfile was previously null
      if (!adminProfile) {
        console.log('Setting loading to false after initial profile load');
        setLoading(false);
      }
    }
  };

  const signIn = async (email, password) => {
    console.log('Attempting sign in for:', email);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('Sign in result:', { data: data ? 'success' : null, error });
      if (error) throw error;
      console.log('Sign in successful');
      return data;
    } catch (error) {
      console.log('Sign in failed:', error);
      setLoading(false);
      throw error;
    }
  };



  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setAdminProfile(null);
    setProfileError(null);
    setLoading(false);
  };

  // Function to refresh the session
  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Session refresh error:', error);
        // If refresh fails, user should be logged out
        signOut();
        return null;
      }
      return session;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  };

  // Function to check session validity and refresh if needed
  const checkAndRefreshSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const currentTime = Math.floor(Date.now() / 1000);
        const expiresAt = session.expires_at;
        
        // If session expires in less than 5 minutes, refresh it
        if (expiresAt && (expiresAt - currentTime) < 300) { // 5 minutes = 300 seconds
          return await refreshSession();
        }
        return session;
      }
      return null;
    } catch (error) {
      console.error('Error checking session:', error);
      return null;
    }
  };



  const value = {
    user,
    adminProfile,
    loading,
    profileError,
    signIn,
    signOut,
    refreshSession,
    checkAndRefreshSession,
    isAuthenticated: !!user && !!adminProfile,
    hasUser: !!user,
    isChairman: adminProfile?.role === 'chairman',
  };


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

