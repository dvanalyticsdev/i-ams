export const AUTH_STORAGE_KEY = 'iams_auth_user';

export const getStoredAuthenticatedUser = () => {
  const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const restoreAuthenticatedUser = () => {
  const user = getStoredAuthenticatedUser();
  return {
    user,
    wasInvalidated: false
  };
};
