import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userPermissionsService } from '../../services/userPermissionsService';

/**
 * Guards routes based on user feature permissions.
 * Redirects to dashboard if user doesn't have access to the current route.
 */
const PermissionGuard = ({ children }) => {
  const { adminProfile } = useAuth();
  const location = useLocation();

  // Check if user has permission to access this route
  const hasAccess = userPermissionsService.canAccessRoute(adminProfile, location.pathname);

  if (!hasAccess) {
    // Redirect to dashboard if access is denied
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PermissionGuard;

