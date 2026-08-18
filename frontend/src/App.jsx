import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Logistics from './pages/Logistics';
import Login from './pages/Login';
import Market from './pages/Market';
import Alerts from './pages/Alerts';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import TopNav from './components/TopNav';

const ROLES = {
  ANY: ['field_officer', 'logistics_manager', 'admin'],
  LOGISTICS_PLUS: ['logistics_manager', 'admin'],
  ADMIN_ONLY: ['admin']
};

export default function App() {
  return (
    <>
      <TopNav />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Any JWT */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={ROLES.ANY}><Dashboard /></ProtectedRoute>
        } />
        <Route path="/market" element={
          <ProtectedRoute allowedRoles={ROLES.ANY}><Market /></ProtectedRoute>
        } />

        {/* Logistics manager + Admin */}
        <Route path="/logistics" element={
          <ProtectedRoute allowedRoles={ROLES.LOGISTICS_PLUS}><Logistics /></ProtectedRoute>
        } />
        <Route path="/alerts" element={
          <ProtectedRoute allowedRoles={ROLES.LOGISTICS_PLUS}><Alerts /></ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={ROLES.LOGISTICS_PLUS}><Reports /></ProtectedRoute>
        } />

        {/* Admin only */}
        <Route path="/analytics" element={
          <ProtectedRoute allowedRoles={ROLES.ADMIN_ONLY}><Analytics /></ProtectedRoute>
        } />
      </Routes>
    </>
  );
}