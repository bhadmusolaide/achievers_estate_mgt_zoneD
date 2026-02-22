import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import PermissionGuard from '../auth/PermissionGuard';
import ToastContainer from '../common/ToastContainer';

const MainLayout = () => {
  // Mobile: sidebar open/closed (slides in/out)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  // Desktop: sidebar collapsed (icons only) or expanded
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem('theme');
    return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'light';
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  const closeSidebar = () => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  const layoutClasses = [
    'app-layout',
    sidebarOpen ? 'sidebar-open' : 'sidebar-closed',
    sidebarCollapsed ? 'sidebar-collapsed' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClasses}>
      {/* Mobile overlay */}
      {sidebarOpen && window.innerWidth <= 768 && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}
      <Sidebar
        onNavClick={closeSidebar}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
        <main className="main-content">
          <PermissionGuard>
            <Outlet context={{
              toggleSidebar,
              sidebarOpen,
              sidebarCollapsed,
              theme,
              toggleTheme
            }} />
          </PermissionGuard>
        </main>
      <ToastContainer />
    </div>
  );
};

export default MainLayout;
