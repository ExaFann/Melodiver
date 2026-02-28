'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Settings } from 'lucide-react';
import type { ApiUser } from '@/types/music';
import { authApi } from '@/hooks/useApi';

interface UserManagementPanelProps {
  user: ApiUser;
  onClose: () => void;
  onUserUpdated: (user: ApiUser) => void;
  onAccountDeleted: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function UserManagementPanel({
  user,
  onClose,
  onUserUpdated,
  onAccountDeleted,
}: UserManagementPanelProps) {
  // Profile
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Stats
  const [stats, setStats] = useState<{
    albumCount: number;
    trackCount: number;
    storageBytes: number;
    createdAt: string | null;
  } | null>(null);

  useEffect(() => {
    authApi.getStats().then(setStats).catch(console.error);
  }, []);

  const handleProfileSave = useCallback(async () => {
    setProfileMsg(null);
    setProfileLoading(true);
    try {
      const updated = await authApi.updateProfile({
        username: username.trim(),
        email: email.trim(),
      });
      onUserUpdated(updated);
      setProfileMsg({ type: 'success', text: 'Profile updated' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setProfileLoading(false);
    }
  }, [username, email, onUserUpdated]);

  const handlePasswordChange = useCallback(async () => {
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setPasswordLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Password changed' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setPasswordLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  const handleDeleteAccount = useCallback(async () => {
    setDeleteMsg(null);
    if (!deletePassword) {
      setDeleteMsg({ type: 'error', text: 'Password required' });
      return;
    }
    setDeleteLoading(true);
    try {
      await authApi.deleteAccount(deletePassword);
      onAccountDeleted();
    } catch (err) {
      setDeleteMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setDeleteLoading(false);
    }
  }, [deletePassword, onAccountDeleted]);

  const profileChanged =
    username.trim() !== user.username || email.trim() !== user.email;

  return (
    <div className="user-panel-overlay" onClick={onClose}>
      <div className="user-panel" onClick={(e) => e.stopPropagation()}>
        <div className="user-panel-header">
          <div className="user-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} />
            Account Settings
          </div>
          <button className="user-panel-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="user-panel-body">
          {/* Stats */}
          {stats && (
            <div className="user-panel-section">
              <div className="user-panel-section-title">Overview</div>
              <div className="user-panel-stat">
                <span className="user-panel-stat-label">Albums</span>
                <span className="user-panel-stat-value">{stats.albumCount}</span>
              </div>
              <div className="user-panel-stat">
                <span className="user-panel-stat-label">Tracks</span>
                <span className="user-panel-stat-value">{stats.trackCount}</span>
              </div>
              <div className="user-panel-stat">
                <span className="user-panel-stat-label">Storage Used</span>
                <span className="user-panel-stat-value">{formatBytes(stats.storageBytes)}</span>
              </div>
              {stats.createdAt && (
                <div className="user-panel-stat">
                  <span className="user-panel-stat-label">Member Since</span>
                  <span className="user-panel-stat-value">
                    {new Date(stats.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}

          <hr className="user-panel-divider" />

          {/* Profile */}
          <div className="user-panel-section">
            <div className="user-panel-section-title">Profile</div>
            <div className="user-panel-field">
              <label className="user-panel-label">Username</label>
              <input
                className="user-panel-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={profileLoading}
              />
            </div>
            <div className="user-panel-field">
              <label className="user-panel-label">Email</label>
              <input
                className="user-panel-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={profileLoading}
              />
            </div>
            {profileMsg && (
              <div className={`user-panel-msg ${profileMsg.type}`}>
                {profileMsg.text}
              </div>
            )}
            <button
              className="user-panel-save-btn"
              onClick={handleProfileSave}
              disabled={profileLoading || !profileChanged}
            >
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <hr className="user-panel-divider" />

          {/* Password */}
          <div className="user-panel-section">
            <div className="user-panel-section-title">Change Password</div>
            <div className="user-panel-field">
              <label className="user-panel-label">Current Password</label>
              <input
                className="user-panel-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>
            <div className="user-panel-field">
              <label className="user-panel-label">New Password</label>
              <input
                className="user-panel-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>
            <div className="user-panel-field">
              <label className="user-panel-label">Confirm New Password</label>
              <input
                className="user-panel-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>
            {passwordMsg && (
              <div className={`user-panel-msg ${passwordMsg.type}`}>
                {passwordMsg.text}
              </div>
            )}
            <button
              className="user-panel-save-btn"
              onClick={handlePasswordChange}
              disabled={
                passwordLoading || !currentPassword || !newPassword || !confirmPassword
              }
            >
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </button>
          </div>

          <hr className="user-panel-divider" />

          {/* Delete Account */}
          <div className="user-panel-section">
            <div className="user-panel-section-title" style={{ color: 'var(--danger)' }}>
              Danger Zone
            </div>
            {!showDeleteConfirm ? (
              <button
                className="user-panel-danger-btn"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Account
              </button>
            ) : (
              <>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  This will permanently delete your account, all albums, tracks, and uploaded files.
                  Enter your password to confirm.
                </p>
                <div className="user-panel-field">
                  <label className="user-panel-label">Password</label>
                  <input
                    className="user-panel-input"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    disabled={deleteLoading}
                    placeholder="Enter password to confirm"
                  />
                </div>
                {deleteMsg && (
                  <div className={`user-panel-msg ${deleteMsg.type}`}>
                    {deleteMsg.text}
                  </div>
                )}
                <div className="user-panel-row">
                  <button
                    className="user-panel-danger-btn"
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading || !deletePassword}
                  >
                    {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    className="user-panel-save-btn"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword('');
                      setDeleteMsg(null);
                    }}
                    style={{ background: 'var(--surface-overlay)', color: 'var(--text-muted)' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
