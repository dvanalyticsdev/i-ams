import { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  FolderTree,
  Menu, 
  X, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  Sun,
  Moon,
  Users,
  Key
} from 'lucide-react';
import { getInitialTheme, applyTheme } from './theme';
import { initializeDB } from './services/expenseService';
import { getDepartments, getExpenseCategories, initializeDepartments, initializeExpenseCategories } from './services/categories';
import Dashboard from './components/Dashboard';
import ExpenseTracker from './components/ExpenseTracker';
import CategoryManagement from './components/CategoryManagement';
import Login from './components/Login';
import AdminManagement from './components/AdminManagement';
import ChangePasswordModal from './components/ChangePasswordModal';
import { LogoSidebar } from './components/BrandLogo';
import { AUTH_STORAGE_KEY, restoreAuthenticatedUser } from './services/auth';
import { apiRequest } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(getInitialTheme());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [categories, setCategories] = useState(getExpenseCategories());
  const [departments, setDepartments] = useState(getDepartments());
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const headerMenuRef = useRef(null);
  
  // Authentication state
  const [user, setUser] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }

  // Initialize database, apply theme, and check login session on load
  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        // Run each step independently – a failed API call must not block the UI
        try {
          await initializeDB();
        } catch {
          // Backend offline – expenseService already falls back to localStorage
        }

        try {
          const initializedCategories = await initializeExpenseCategories();
          if (isMounted) setCategories(initializedCategories);
        } catch {
          // Falls back to default categories already loaded in state
        }

        try {
          const initializedDepartments = await initializeDepartments();
          if (isMounted) setDepartments(initializedDepartments);
        } catch {
          // Falls back to default departments already loaded in state
        }

        applyTheme(theme);

        const { user: restoredUser } = restoreAuthenticatedUser();
        if (restoredUser && isMounted) {
          try {
            const validatedUser = await apiRequest('/auth/validate', {
              method: 'POST',
              body: JSON.stringify({
                username: restoredUser.username,
                sessionToken: restoredUser.sessionToken
              })
            });
            setUser(validatedUser);
            if (validatedUser.mustChangePassword) {
              setForcePasswordChange(true);
              setIsPasswordModalOpen(true);
            }
          } catch {
            window.localStorage.removeItem(AUTH_STORAGE_KEY);
            showToast('Session expired or credentials changed. Please log in again.', 'warning');
          }
        }
      } catch (error) {
        // Safety net – unexpected error
        showToast(`Startup error: ${error.message}`, 'warning');
      } finally {
        // ALWAYS unblock the UI regardless of what happened above
        if (isMounted) setIsBootstrapping(false);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        setHeaderMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const handleLoginSuccess = (userData) => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
    showToast("Authentication successful. Welcome to i-AMS Console.", "success");
    if (userData.mustChangePassword) {
      setForcePasswordChange(true);
      setIsPasswordModalOpen(true);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setHeaderMenuOpen(false);
    setUser(null);
    setActiveTab('dashboard');
    showToast("Session closed. Logged out successfully.", "success");
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const pageMeta = {
    dashboard: {
      title: 'Ledger Board',
      subtitle: 'Track spend movement, trends, and the latest accounting activity.'
    },
    tracker: {
      title: 'Expense Directory',
      subtitle: 'Manage claims, imports, filters, and record-level accounting actions.'
    },
    categories: {
      title: 'Category Management',
      subtitle: 'Control the category structure used across all expense records.'
    },
    admins: {
      title: 'Administrator Registry',
      subtitle: 'Manage administrative privileges and access control.'
    }
  };



  if (isBootstrapping) {
    return null;
  }

  // 1. Protected Routing: Render Login page if unauthenticated
  if (!user) {
    return (
      <>
        <Login
          onLoginSuccess={handleLoginSuccess}
          theme={theme}
          onThemeToggle={handleThemeToggle}
        />

        {/* TOAST SYSTEM (Rendered globally) */}
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {t.type === 'success' ? (
                  <CheckCircle2 size={16} color="var(--success)" />
                ) : (
                  <AlertCircle size={16} color="var(--primary)" />
                )}
                <span>{t.message}</span>
              </div>
              <button className="toast-close" onClick={() => removeToast(t.id)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  // 2. Main Dashboard & Tracker Shell for Authenticated Admins
  return (
    <div className="app-container">
        {/* LEFT SIDEBAR */}
      <aside id="primary-sidebar" className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <LogoSidebar />
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <button
            type="button"
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('dashboard');
              setSidebarOpen(false);
            }}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'tracker' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('tracker');
              setSidebarOpen(false);
            }}
            aria-current={activeTab === 'tracker' ? 'page' : undefined}
          >
            <ReceiptText size={16} />
            <span>Expense Tracker</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('categories');
              setSidebarOpen(false);
            }}
            aria-current={activeTab === 'categories' ? 'page' : undefined}
          >
            <FolderTree size={16} />
            <span>Categories</span>
          </button>

          {user.role === 'Super Admin' && (
            <button
              type="button"
              className={`nav-item ${activeTab === 'admins' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('admins');
                setSidebarOpen(false);
              }}
              aria-current={activeTab === 'admins' ? 'page' : undefined}
            >
              <Users size={16} />
              <span>Admin Accounts</span>
            </button>
          )}
        </nav>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="main-panel">
        {/* HEADER */}
        <header className="header">
          <div className="header-inner">
            <div className="header-title-section" style={{ gap: '14px' }}>
              <button
                className="menu-toggle-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={sidebarOpen}
                aria-controls="primary-sidebar"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div className="header-copy">
                <h1 className="header-title">{pageMeta[activeTab].title}</h1>
                <p className="header-subtitle">{pageMeta[activeTab].subtitle}</p>
              </div>
            </div>

            <div className="header-right" ref={headerMenuRef}>
              <div className="user-profile user-profile--compact">
                <span className="user-profile-chip">{user.role}</span>
              </div>

              <button
                type="button"
                className="header-actions-toggle"
                onClick={() => setHeaderMenuOpen((prev) => !prev)}
                aria-expanded={headerMenuOpen}
                aria-haspopup="menu"
                title="Open quick actions"
              >
                {headerMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div className={`header-actions-menu ${headerMenuOpen ? 'open' : ''}`} role="menu">
                <button
                  type="button"
                  className="header-actions-item"
                  onClick={handleThemeToggle}
                  role="menuitem"
                >
                  <span className={`header-theme-switch ${theme === 'dark' ? 'is-dark' : ''}`}>
                    <span className="header-theme-switch__thumb">
                      <span className="header-theme-switch__icon header-theme-switch__icon--sun">
                        <Sun size={12} />
                      </span>
                      <span className="header-theme-switch__icon header-theme-switch__icon--moon">
                        <Moon size={12} />
                      </span>
                    </span>
                  </span>
                  <span>{theme === 'light' ? 'Light' : 'Dark'} Mode</span>
                </button>

                <button
                  type="button"
                  className="header-actions-item"
                  onClick={() => {
                    setForcePasswordChange(false);
                    setIsPasswordModalOpen(true);
                    setHeaderMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <span className="header-actions-item__icon">
                    <Key size={16} />
                  </span>
                  <span>Change Password</span>
                </button>

                <button
                  type="button"
                  className="header-actions-item header-actions-item--danger"
                  onClick={handleLogout}
                  role="menuitem"
                >
                  <span className="header-actions-item__icon">
                    <LogOut size={16} />
                  </span>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <main className="content-area">
          {activeTab === 'dashboard' ? (
            <Dashboard
              categories={categories}
              departments={departments}
              showToast={showToast}
            />
          ) : activeTab === 'categories' ? (
            <CategoryManagement
              categories={categories}
              departments={departments}
              onCategoriesChange={setCategories}
              onDepartmentsChange={setDepartments}
              showToast={showToast}
            />
          ) : activeTab === 'admins' && user.role === 'Super Admin' ? (
            <AdminManagement
              user={user}
              showToast={showToast}
            />
          ) : (
            <ExpenseTracker
              categories={categories}
              departments={departments}
              onCategoriesChange={setCategories}
              onDepartmentsChange={setDepartments}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* TOAST SYSTEM */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {t.type === 'success' ? (
                <CheckCircle2 size={16} color="var(--success)" />
              ) : (
                <AlertCircle size={16} color="var(--primary)" />
              )}
              <span>{t.message}</span>
            </div>
            <button className="toast-close" onClick={() => removeToast(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* CHANGE PASSWORD MODAL */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        user={user}
        mustChange={forcePasswordChange}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={() => {
          setIsPasswordModalOpen(false);
          setForcePasswordChange(false);
          const updatedUser = { ...user, mustChangePassword: false };
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
          setUser(updatedUser);
        }}
        showToast={showToast}
      />
    </div>
  );
}

export default App;
