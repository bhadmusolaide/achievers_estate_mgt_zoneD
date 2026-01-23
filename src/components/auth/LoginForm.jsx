import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Loader2, AlertCircle, Heart } from 'lucide-react';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, isAuthenticated, hasUser, profileError, loading } = useAuth();
  const navigate = useNavigate();

  // Navigate to dashboard when authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  // Show profile error if user exists but no profile
  // Derive error from context state instead of using setState in effect
  const derivedError = hasUser && profileError && !loading ? profileError : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await signIn(email, password);
      // Navigation will happen via useEffect when isAuthenticated becomes true
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
      setSubmitting(false);
    }
  };

  const isLoading = submitting || loading;
  const displayError = error || derivedError;

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Achievers 1 Estate - Zone D</h1>
          <p>Landlord Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {displayError && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{displayError}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="spin" size={18} />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Access restricted to authorized administrators only</p>
        </div>
      </div>

      <div className="login-credit">
        <span>
          Built with <Heart size={10} className="heart-icon" /> by AlanCash (08068530494) - 2026
        </span>
      </div>
    </div>
  );
};

export default LoginForm;

