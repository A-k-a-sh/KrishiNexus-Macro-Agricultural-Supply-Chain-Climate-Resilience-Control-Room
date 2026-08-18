import { Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, isAuthLoading } = useContext(AppContext);
  const token = localStorage.getItem('accessToken');

  if (isAuthLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!token || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
