import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  Settings,
  LogOut,
  Home,
  PartyPopper,
  Upload,
  ClipboardList,
  ScrollText,
  PieChart,
  ChevronLeft,
  ChevronRight,
  Heart,
  ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userPermissionsService } from '../../services/userPermissionsService';

const Sidebar = ({ onNavClick, collapsed, onToggleCollapse }) => {
  const { adminProfile, signOut } = useAuth();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/landlords', icon: Users, label: 'Landlords' },
    { to: '/financial-overview', icon: PieChart, label: 'Est. Payment Center' },
    { to: '/transactions', icon: ArrowLeftRight, label: 'Account Management' },
    { to: '/payments', icon: CreditCard, label: 'Payments' },
    { to: '/receipts', icon: Receipt, label: 'Receipts' },
    { to: '/onboarding', icon: ClipboardList, label: 'Onboarding' },  
    { to: '/celebrations', icon: PartyPopper, label: 'Celebrations' },
    { to: '/bulk-import', icon: Upload, label: 'Bulk Import' },
    { to: '/audit-log', icon: ScrollText, label: 'Audit Log' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  // Filter nav items based on user permissions
  const accessibleNavItems = userPermissionsService.getAccessibleNavItems(adminProfile, navItems);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <Home size={28} />
        {!collapsed && (
          <div className="sidebar-brand">
            <h2>Achievers - Zone D</h2>
            <span>Estate Management System</span>
          </div>
        )}
      </div>

      {/* Collapse toggle button */}
      <button
        className="sidebar-collapse-btn"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <nav className="sidebar-nav">
        <ul>
          {accessibleNavItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                onClick={onNavClick}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar" title={collapsed ? adminProfile?.full_name : undefined}>
            {adminProfile?.full_name?.charAt(0) || 'A'}
          </div>
          {!collapsed && (
            <div className="user-details">
              <span className="user-name">{adminProfile?.full_name || 'Admin'}</span>
              <span className="user-role">{adminProfile?.role || 'Officer'}</span>
            </div>
          )}
        </div>
        <button onClick={signOut} className="btn-logout" title="Sign Out">
          <LogOut size={20} />
        </button>
      </div>

      <div className="sidebar-credit" title={collapsed ? 'Built with love by Alancash' : undefined}>
        {collapsed ? (
          <Heart size={12} />
        ) : (
          <span>
            Built with <Heart size={10} className="heart-icon" /> by AlanCash (08068530494)
          </span>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

