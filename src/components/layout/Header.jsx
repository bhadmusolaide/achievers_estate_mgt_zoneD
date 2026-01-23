import { Bell, Menu } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Header = ({ title }) => {
  const { adminProfile } = useAuth();
  const { toggleSidebar } = useOutletContext() || {};

  return (
    <header className="main-header">
      <div className="header-left">
        <button className="menu-toggle" onClick={toggleSidebar}>
          <Menu size={24} />
        </button>
        <h1 className="page-title">{title}</h1>
      </div>

      <div className="header-right">
        <button className="btn-icon" title="Notifications">
          <Bell size={20} />
        </button>
        <div className="header-user">
          <span className="header-user-name">{adminProfile?.full_name}</span>
          <span className="badge">{adminProfile?.zone}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;

