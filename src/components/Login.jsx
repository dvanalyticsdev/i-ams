import { useState } from 'react';
import { Lock, User, RefreshCw, AlertCircle, Sun, Moon } from 'lucide-react';
import { LogoFull } from './BrandLogo';
import { apiRequest } from '../services/api';

function Login({ onLoginSuccess, theme, onThemeToggle }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Frontend validations
    if (!loginId.trim()) {
      setError('Login ID is required.');
      return;
    }
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }

    setIsLoading(true);

    try {
      const userData = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: loginId.trim(),
          password: password.trim()
        })
      });
      setIsLoading(false);
      onLoginSuccess(userData);
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Invalid Login ID or Password. Please try again.');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-background-decor"></div>

      <button
        type="button"
        className="theme-toggle login-theme-toggle"
        onClick={onThemeToggle}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        <span className="theme-toggle__stack" aria-hidden="true">
          <span className="theme-toggle__icon theme-toggle__icon--sun">
            <Sun />
          </span>
          <span className="theme-toggle__icon theme-toggle__icon--moon">
            <Moon />
          </span>
        </span>
        <span className="theme-toggle__label">{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
      
      <div className="card login-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Full Branding Logo */}
        <LogoFull />
        
        {error && (
          <div className="login-error-banner" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            color: 'var(--danger)',
            fontSize: '12px',
            margin: '0'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="input-with-icon">
            <label>Login ID</label>
            <input 
              type="text" 
              placeholder="Enter admin login ID" 
              value={loginId} 
              onChange={(e) => setLoginId(e.target.value)}
              disabled={isLoading}
            />
            <User size={14} />
          </div>

          <div className="input-with-icon">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="Enter password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <Lock size={14} />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={isLoading}
            style={{ 
              width: '100%', 
              height: '38px', 
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Authenticating Console...</span>
              </>
            ) : (
              <span>Access Ledger Board</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
