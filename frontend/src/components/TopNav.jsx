import { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const TopNav = () => {
  const { currentUser, setCurrentUser } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    <nav className="bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/80 sticky top-0 z-50 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/10 to-teal-900/10 pointer-events-none"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex items-center justify-between h-16">
          
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mr-3 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
                <svg className="w-5 h-5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                </svg>
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">
                Krishi<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Nexus</span>
              </span>
            </Link>
            
            <div className="hidden md:flex space-x-2">
              {navLinks.filter(link => link.roles.includes(currentUser.role)).map(link => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 relative overflow-hidden ${
                      isActive
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-emerald-400 rounded-t-full"></span>
                    )}
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <div className="text-right">
              <div className="text-sm font-bold text-slate-200">{currentUser.name}</div>
              <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider">{roleLabels[currentUser.role] || currentUser.role}</div>
            </div>
            
            <div className="w-px h-8 bg-slate-800"></div>

            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 text-sm font-bold text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/30 border border-transparent rounded-lg transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
              </svg>
              Sign Out
            </button>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-400 hover:text-white focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navLinks.filter(link => link.roles.includes(currentUser.role)).map(link => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center px-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                {currentUser.name.charAt(0)}
              </div>
              <div className="ml-3">
                <div className="text-base font-medium leading-none text-white">{currentUser.name}</div>
                <div className="text-sm font-medium leading-none text-slate-400 mt-1">{roleLabels[currentUser.role] || currentUser.role}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-400 hover:text-white hover:bg-red-500/20"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default TopNav;
