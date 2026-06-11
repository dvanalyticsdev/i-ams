export const getInitialTheme = () => {
  if (typeof window !== 'undefined') {
    const savedTheme = window.localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }
    const userPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return userPrefersDark ? 'dark' : 'light';
  }
  return 'light';
};

export const applyTheme = (theme) => {
  if (typeof window !== 'undefined') {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    window.localStorage.setItem('theme', theme);
  }
};
