const adminLoginId = import.meta.env.VITE_ADMIN_LOGIN_ID || '';
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || '';

export const AUTH_STORAGE_KEY = 'iams_auth_user';

const encodeSessionSignature = (value) => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(value);
  }

  return value;
};

export const hasConfiguredAdminCredentials = () => Boolean(adminLoginId && adminPassword);

export const isValidAdminCredentialPair = (loginId, password) => (
  loginId.trim() === adminLoginId && password.trim() === adminPassword
);

export const getCurrentSessionSignature = () => (
  hasConfiguredAdminCredentials()
    ? encodeSessionSignature(`${adminLoginId}:${adminPassword}`)
    : ''
);

export const buildAuthenticatedUser = () => ({
  username: adminLoginId,
  role: 'Administrator',
  name: 'Admin User',
  sessionSignature: getCurrentSessionSignature()
});

export const getStoredAuthenticatedUser = () => {
  const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(storedUser);
    const currentSignature = getCurrentSessionSignature();

    if (!parsedUser?.username || parsedUser.sessionSignature !== currentSignature) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return parsedUser;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const restoreAuthenticatedUser = () => {
  const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedUser) {
    return { user: null, wasInvalidated: false };
  }

  const user = getStoredAuthenticatedUser();
  return {
    user,
    wasInvalidated: !user
  };
};
