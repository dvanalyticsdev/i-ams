import { useState } from 'react';
import { Lock, Eye, EyeOff, RefreshCw, AlertCircle, X } from 'lucide-react';
import { apiRequest } from '../services/api';

function ChangePasswordModal({ isOpen, user, onClose, mustChange, onSuccess, showToast }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword.trim()) {
      setError('Current password is required.');
      return;
    }
    if (!newPassword.trim()) {
      setError('New password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password cannot be the same as current password.');
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          username: user.username,
          sessionToken: user.sessionToken,
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim()
        })
      });
      
      showToast('Password changed successfully.', 'success');
      setIsLoading(false);
      
      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      onSuccess();
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Failed to change password. Please verify current password.');
    }
  };

  return (
    <div className="dialog-backdrop" style={{ zIndex: 600 }}>
      <div className="card dialog-card dialog-card--sm" role="dialog" aria-modal="true" aria-label="Change Password">
        <div className="dialog-header">
          <h2 className="dialog-title">
            {mustChange ? 'Setup New Password' : 'Change Password'}
          </h2>
          {!mustChange && (
            <button className="dialog-close" onClick={onClose} aria-label="Close dialog">
              <X size={16} />
            </button>
          )}
        </div>

        {mustChange && (
          <div style={{
            display: 'flex',
            gap: '8px',
            backgroundColor: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            color: 'var(--primary)',
            fontSize: '12px',
            marginBottom: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>You are currently using default credentials. For security reasons, you must change your password to continue.</span>
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            color: 'var(--danger)',
            fontSize: '12px',
            marginBottom: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="input-with-icon" style={{ position: 'relative' }}>
            <label>Current Password</label>
            <input 
              type={showCurrent ? "text" : "password"} 
              placeholder="Enter current password" 
              value={currentPassword} 
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              style={{ paddingRight: '40px' }}
            />
            <Lock size={14} />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              style={{
                position: 'absolute',
                right: '4px',
                bottom: '0px',
                height: '38px',
                width: '34px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              disabled={isLoading}
            >
              {showCurrent ? (
                <EyeOff size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
              ) : (
                <Eye size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
              )}
            </button>
          </div>

          <div className="input-with-icon" style={{ position: 'relative' }}>
            <label>New Password</label>
            <input 
              type={showNew ? "text" : "password"} 
              placeholder="Enter new password (min 6 chars)" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              style={{ paddingRight: '40px' }}
            />
            <Lock size={14} />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              style={{
                position: 'absolute',
                right: '4px',
                bottom: '0px',
                height: '38px',
                width: '34px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              disabled={isLoading}
            >
              {showNew ? (
                <EyeOff size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
              ) : (
                <Eye size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
              )}
            </button>
          </div>

          <div className="input-with-icon" style={{ position: 'relative' }}>
            <label>Confirm New Password</label>
            <input 
              type={showConfirm ? "text" : "password"} 
              placeholder="Confirm new password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              style={{ paddingRight: '40px' }}
            />
            <Lock size={14} />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              style={{
                position: 'absolute',
                right: '4px',
                bottom: '0px',
                height: '38px',
                width: '34px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              disabled={isLoading}
            >
              {showConfirm ? (
                <EyeOff size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
              ) : (
                <Eye size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
              )}
            </button>
          </div>

          <div className="dialog-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
            {!mustChange && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
            )}
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: mustChange ? '100%' : 'auto'
              }}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Updating password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordModal;
