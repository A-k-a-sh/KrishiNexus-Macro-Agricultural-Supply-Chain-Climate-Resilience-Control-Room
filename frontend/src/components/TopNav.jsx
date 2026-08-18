import { useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const TopNav = () => {
  const { currentUser, setCurrentUser } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  if (!currentUser) return null;

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setCurrentUser(null);
    navigate('/login');
  };

  const roleLabels = {
    field_officer: 'Field Officer',
    logistics_manager: 'Logistics Manager',
    admin: 'System Admin'
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', roles: ['field_officer', 'logistics_manager', 'admin'] },
    { name: 'Market', path: '/market', roles: ['field_officer', 'logistics_manager', 'admin'] },
    { name: 'Logistics', path: '/logistics', roles: ['logistics_manager', 'admin'] },
    { name: 'Alerts', path: '/alerts', roles: ['logistics_manager', 'admin'] },
    { name: 'Reports', path: '/reports', roles: ['logistics_manager', 'admin'] },
    { name: 'Analytics', path: '/analytics', roles: ['admin'] },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center">
              <span className="text-xl font-bold text-white tracking-tight">Krishi<span className="text-emerald-500">Nexus</span></span>
            </Link>
            <div className="hidden md:flex space-x-4">
              {navLinks.filter(link => link.roles.includes(currentUser.role)).map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-white">{currentUser.name}</div>
              <div className="text-xs text-emerald-400">{roleLabels[currentUser.role] || currentUser.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
