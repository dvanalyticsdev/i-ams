import { useState, useEffect } from 'react';
import { UserPlus, Trash2, RefreshCw, AlertCircle, Shield, Calendar, User, Lock, Key, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../services/api';

function AdminManagement({ user, showToast }) {
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passwordModalTarget, setPasswordModalTarget] = useState(null);

  // New Admin Form State
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Change Password Form State
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [passwordFormError, setPasswordFormError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  // Fetch Admins List (used for user-triggered events like creation/deletion)
  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest(`/auth/admins?username=${encodeURIComponent(user.username)}&token=${encodeURIComponent(user.sessionToken)}`);
      setAdmins(data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch admin accounts.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await apiRequest(`/auth/admins?username=${encodeURIComponent(user.username)}&token=${encodeURIComponent(user.sessionToken)}`);
        if (isMounted) {
          setAdmins(data || []);
        }
      } catch (err) {
        if (isMounted) {
          showToast(err.message || 'Failed to fetch admin accounts.', 'danger');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [user.username, user.sessionToken]);

  const handleCreateAdminSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!newUsername.trim()) {
      setFormError('Login ID is required.');
      return;
    }
    if (/\s/.test(newUsername)) {
      setFormError('Login ID cannot contain spaces.');
      return;
    }
    if (!newName.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (!newPassword.trim()) {
      setFormError('Password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsCreating(true);

    try {
      await apiRequest('/auth/create-admin', {
        method: 'POST',
        body: JSON.stringify({
          username: user.username,
          sessionToken: user.sessionToken,
          adminUsername: newUsername.trim(),
          adminPassword: newPassword.trim(),
          adminName: newName.trim()
        })
      });

      showToast(`Admin account "${newUsername}" created successfully.`, 'success');
      setIsModalOpen(false);
      
      // Clear form
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Refresh list
      fetchAdmins();
    } catch (err) {
      setFormError(err.message || 'Failed to create admin account.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAdmin = async (targetUsername) => {
    if (!window.confirm(`Are you sure you want to delete the administrator account "${targetUsername}"? This user will immediately lose access.`)) {
      return;
    }

    try {
      const result = await apiRequest(`/auth/admins/delete/${encodeURIComponent(targetUsername)}`, {
        method: 'POST',
        body: JSON.stringify({
          username: user.username,
          token: user.sessionToken
        })
      });

      if (result.success) {
        showToast(`Account "${targetUsername}" deleted successfully.`, 'success');
        fetchAdmins();
      } else {
        showToast('Failed to delete account.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete account.', 'danger');
    }
  };

  const resetPasswordModalState = () => {
    setPasswordModalTarget(null);
    setResetPassword('');
    setResetConfirmPassword('');
    setPasswordFormError('');
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
    setIsUpdatingPassword(false);
  };

  const handleOpenPasswordModal = (admin) => {
    setPasswordFormError('');
    setResetPassword('');
    setResetConfirmPassword('');
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
    setPasswordModalTarget(admin);
  };

  const handleChangeAdminPassword = async (e) => {
    e.preventDefault();
    setPasswordFormError('');

    if (!passwordModalTarget) {
      return;
    }
    if (!resetPassword.trim()) {
      setPasswordFormError('New password is required.');
      return;
    }
    if (resetPassword.trim().length < 6) {
      setPasswordFormError('Password must be at least 6 characters.');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setPasswordFormError('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const result = await apiRequest(`/auth/admins/change-password/${encodeURIComponent(passwordModalTarget.username)}`, {
        method: 'POST',
        body: JSON.stringify({
          username: user.username,
          token: user.sessionToken,
          newPassword: resetPassword.trim()
        })
      });

      showToast(
        passwordModalTarget.username === user.username
          ? 'Your Super Admin password was updated successfully.'
          : `Password updated for "${passwordModalTarget.username}". They will be asked to change it after login.`,
        'success'
      );
      resetPasswordModalState();
      if (result?.message) {
        fetchAdmins();
      }
    } catch (err) {
      setPasswordFormError(err.message || 'Failed to update password.');
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="admin-management-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HEADER SECTION */}
      <div className="directory-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>Administrator Registry</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Maintain secondary console logins and authentication profiles.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => {
            setFormError('');
            setIsModalOpen(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <UserPlus size={16} />
          <span>Add Secondary Admin</span>
        </button>
      </div>

      {/* TABLE/GRID SECTION */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <RefreshCw className="animate-spin" size={24} />
          <span style={{ marginLeft: '10px' }}>Fetching administrator registry...</span>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '20px' }}>User Details</th>
                  <th>Login ID</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      No administrator accounts found.
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.username}>
                      <td style={{ paddingLeft: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: admin.role === 'Super Admin' ? 'var(--primary-soft)' : 'var(--surface-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: admin.role === 'Super Admin' ? 'var(--primary)' : 'var(--text-muted)',
                            border: '1px solid var(--border)'
                          }}>
                            {admin.role === 'Super Admin' ? <Shield size={16} /> : <User size={16} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text)' }}>{admin.name}</div>
                            {admin.username === user.username && (
                              <span style={{
                                fontSize: '10px',
                                backgroundColor: 'var(--primary-soft)',
                                color: 'var(--primary)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: '500'
                              }}>You</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: '12px', color: 'var(--primary)' }}>{admin.username}</code>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: admin.role === 'Super Admin' ? 'var(--primary-soft)' : 'var(--surface-muted)',
                          color: admin.role === 'Super Admin' ? 'var(--primary)' : 'var(--text)',
                          border: '1px solid var(--border)'
                        }}>
                          {admin.role}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                          <Calendar size={13} />
                          <span>{admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => handleOpenPasswordModal(admin)}
                            style={{
                              color: 'var(--primary)',
                              border: '1px solid transparent',
                              padding: '6px',
                              borderRadius: 'var(--radius-sm)'
                            }}
                            title={admin.username === user.username ? 'Change Your Password' : 'Set Admin Password'}
                          >
                            <Key size={15} />
                          </button>

                          {admin.username !== user.username && admin.role !== 'Super Admin' ? (
                            <button
                              className="btn btn-secondary btn-icon"
                              onClick={() => handleDeleteAdmin(admin.username)}
                              style={{
                                color: 'var(--danger)',
                                border: '1px solid transparent',
                                padding: '6px',
                                borderRadius: 'var(--radius-sm)'
                              }}
                              title="Delete Admin Account"
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Protected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE NEW ADMIN MODAL */}
      {isModalOpen && (
        <div className="dialog-backdrop">
          <div className="card dialog-card dialog-card--sm" role="dialog" aria-modal="true" aria-label="Create Secondary Admin">
            <div className="dialog-header">
              <h2 className="dialog-title">New Secondary Admin</h2>
              <button 
                className="dialog-close" 
                onClick={() => setIsModalOpen(false)}
                disabled={isCreating}
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
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
                margin: 0
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="input-with-icon">
                <label>Login ID (Username)</label>
                <input 
                  type="text" 
                  placeholder="e.g. secondary_admin" 
                  value={newUsername} 
                  onChange={(e) => setNewUsername(e.target.value)}
                  disabled={isCreating}
                />
                <User size={14} />
              </div>

              <div className="input-with-icon">
                <label>Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Jane Doe" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={isCreating}
                />
                <User size={14} />
              </div>

              <div className="input-with-icon">
                <label>Credentials Password</label>
                <input 
                  type="password" 
                  placeholder="Set account password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isCreating}
                />
                <Lock size={14} />
              </div>

              <div className="input-with-icon">
                <label>Confirm Password</label>
                <input 
                  type="password" 
                  placeholder="Confirm set password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isCreating}
                />
                <Lock size={14} />
              </div>

              <div className="dialog-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isCreating}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isCreating ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Register Admin</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordModalTarget && (
        <div className="dialog-backdrop">
          <div className="card dialog-card dialog-card--sm" role="dialog" aria-modal="true" aria-label="Change Administrator Password">
            <div className="dialog-header">
              <h2 className="dialog-title">
                {passwordModalTarget.username === user.username ? 'Update Super Admin Password' : `Set Password for ${passwordModalTarget.name}`}
              </h2>
              <button
                className="dialog-close"
                onClick={resetPasswordModalState}
                disabled={isUpdatingPassword}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              {passwordModalTarget.username === user.username
                ? 'Set a new password for the Super Admin account.'
                : 'Set a temporary password for this admin account. They will be asked to change it after signing in.'}
            </p>

            {passwordFormError && (
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
                margin: 0
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{passwordFormError}</span>
              </div>
            )}

            <form onSubmit={handleChangeAdminPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <label>New Password</label>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  disabled={isUpdatingPassword}
                  style={{ paddingRight: '40px' }}
                />
                <Lock size={14} />
                <button
                  type="button"
                  onClick={() => setShowResetPassword((prev) => !prev)}
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
                  disabled={isUpdatingPassword}
                >
                  {showResetPassword ? (
                    <EyeOff size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
                  ) : (
                    <Eye size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
                  )}
                </button>
              </div>

              <div className="input-with-icon" style={{ position: 'relative' }}>
                <label>Confirm Password</label>
                <input
                  type={showResetConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  disabled={isUpdatingPassword}
                  style={{ paddingRight: '40px' }}
                />
                <Lock size={14} />
                <button
                  type="button"
                  onClick={() => setShowResetConfirmPassword((prev) => !prev)}
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
                  disabled={isUpdatingPassword}
                >
                  {showResetConfirmPassword ? (
                    <EyeOff size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
                  ) : (
                    <Eye size={16} style={{ position: 'static', transform: 'none', pointerEvents: 'auto', left: 'auto', color: 'inherit' }} />
                  )}
                </button>
              </div>

              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetPasswordModalState}
                  disabled={isUpdatingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isUpdatingPassword}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isUpdatingPassword ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Close Icon for Dialog
function X(props) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={props.size || "24"} 
      height={props.size || "24"} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}

export default AdminManagement;
