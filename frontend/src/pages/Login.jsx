import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import LoginForm from '../components/Auth/LoginForm';

const Login = () => {
  const { currentUser, isAuthLoading } = useContext(AppContext);
  const token = localStorage.getItem('accessToken');

  if (isAuthLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  // If already logged in, go to dashboard
  if (token && currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <LoginForm />
    </div>
  );
};

export default Login;
