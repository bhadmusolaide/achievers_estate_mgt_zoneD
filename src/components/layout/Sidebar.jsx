import { NavLink, useLocation } from 'react-router-dom';
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
  ArrowLeftRight,
  Building2,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userPermissionsService } from '../../services/userPermissionsService';
import { feedbackService } from '../../services/feedbackService';
import { paymentService } from '../../services/paymentService';
import { onboardingService } from '../../services/onboardingService';
import { celebrationService } from '../../services/celebrationService';
import { receiptService } from '../../services/receiptService';
import { useState, useEffect, useCallback } from 'react';

const Sidebar = ({ onNavClick, collapsed, onToggleCollapse }) => {
  const { adminProfile, signOut } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [pendingOnboardingCount, setPendingOnboardingCount] = useState(0);
  const [pendingCelebrationCount, setPendingCelebrationCount] = useState(0);
  const [unsentReceiptCount, setUnsentReceiptCount] = useState(0);
  const location = useLocation();
  const isFeedbackPage = location.pathname === '/feedback';
  const isPaymentsPage = location.pathname === '/payments';
  const isOnboardingPage = location.pathname === '/onboarding';
  const isCelebrationsPage = location.pathname === '/celebrations';
  const isReceiptsPage = location.pathname === '/receipts';

  const fetchCounts = useCallback(async () => {
    try {
      const [feedbackCount, paymentCount, onboardingStats, celebrationCount, receiptCount] = await Promise.all([
        isFeedbackPage ? Promise.resolve(0) : feedbackService.getUnreadCount(),
        isPaymentsPage ? Promise.resolve(0) : paymentService.getPendingCount(),
        isOnboardingPage ? Promise.resolve({ pending: 0 }) : onboardingService.getStats(),
        isCelebrationsPage ? Promise.resolve(0) : celebrationService.getPendingCount(),
        isReceiptsPage ? Promise.resolve(0) : receiptService.getUnsentCount(),
      ]);
      setUnreadCount(feedbackCount);
      setPendingPaymentCount(paymentCount);
      setPendingOnboardingCount(onboardingStats.pending);
      setPendingCelebrationCount(celebrationCount);
      setUnsentReceiptCount(receiptCount);
    } catch {
      // Silently fail
    }
  }, [isFeedbackPage, isPaymentsPage, isOnboardingPage, isCelebrationsPage, isReceiptsPage]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts, location.pathname]);

  const navItems = [
    {
      to: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      tooltip: 'Your command center for today—track key metrics, alerts, and activity at a glance.'
    },
    {
      to: '/landlords',
      icon: Users,
      label: 'Landlords',
      tooltip: 'Manage landlord profiles, contact details, and property information.'
    },
    {
      to: '/financial-overview',
      icon: PieChart,
      label: 'Financial Overview',
      tooltip: 'See who owes what, what has been paid, and outstanding balances by landlord.'
    },
    {
      to: '/transactions',
      icon: ArrowLeftRight,
      label: 'Transactions',
      tooltip: 'Review credits and debits, and keep the estate account reconciled.'
    },
    {
      to: '/payments',
      icon: CreditCard,
      label: 'Payments',
      tooltip: 'Log and confirm incoming payments from landlords.'
    },
    {
      to: '/receipts',
      icon: Receipt,
      label: 'Receipts',
      tooltip: 'Generate and view receipts for recorded payments.'
    },
    {
      to: '/onboarding',
      icon: ClipboardList,
      label: 'Onboarding',
      tooltip: 'Track new landlord onboarding tasks and completion status.'
    },
    {
      to: '/celebrations',
      icon: PartyPopper,
      label: 'Celebrations',
      tooltip: 'Manage birthday and celebration messaging for landlords.'
    },
    {
      to: '/bulk-import',
      icon: Upload,
      label: 'Bulk Import',
      tooltip: 'Upload many landlords at once using a spreadsheet.'
    },
    {
      to: '/audit-log',
      icon: ScrollText,
      label: 'Audit Log',
      tooltip: 'Review a chronological trail of key actions in the system.'
    },
    {
      to: '/zone-management',
      icon: Building2,
      label: 'Zone Management',
      tooltip: 'Manage projects, pledges, and public zone information.'
    },
    {
      to: '/feedback',
      icon: MessageSquare,
      label: 'Feedback',
      tooltip: 'View and manage feedback submitted by landlords.'
    },
    {
      to: '/settings',
      icon: Settings,
      label: 'Settings',
      tooltip: 'Configure system preferences, roles, and operational rules.'
    },
  ];

  // Filter nav items based on user permissions
  const accessibleNavItems = userPermissionsService.getAccessibleNavItems(adminProfile, navItems);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <Home size={28} />
        {!collapsed && (
          <div className="sidebar-brand">
            <h4>Achievers 1 - Zone D</h4>
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
                title={item.tooltip}
              >
                <item.icon size={20} />
                {!collapsed && <span>{item.label}</span>}
                {item.to === '/feedback' && unreadCount > 0 && (
                  <span className="sidebar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
                {item.to === '/payments' && pendingPaymentCount > 0 && (
                  <span className="sidebar-badge">{pendingPaymentCount > 99 ? '99+' : pendingPaymentCount}</span>
                )}
                {item.to === '/onboarding' && pendingOnboardingCount > 0 && (
                  <span className="sidebar-badge">{pendingOnboardingCount > 99 ? '99+' : pendingOnboardingCount}</span>
                )}
                {item.to === '/celebrations' && pendingCelebrationCount > 0 && (
                  <span className="sidebar-badge">{pendingCelebrationCount > 99 ? '99+' : pendingCelebrationCount}</span>
                )}
                {item.to === '/receipts' && unsentReceiptCount > 0 && (
                  <span className="sidebar-badge">{unsentReceiptCount > 99 ? '99+' : unsentReceiptCount}</span>
                )}
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
