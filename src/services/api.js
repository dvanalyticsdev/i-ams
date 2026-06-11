const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || 'Request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};
