import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import { isApprover, isAdmin } from './utils.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ApplyLeave from './pages/ApplyLeave.jsx';
import MyLeaves from './pages/MyLeaves.jsx';
import TeamCalendar from './pages/TeamCalendar.jsx';
import Profile from './pages/Profile.jsx';
import Approvals from './pages/manager/Approvals.jsx';
import TeamBalances from './pages/manager/TeamBalances.jsx';
import TeamReports from './pages/manager/TeamReports.jsx';
import Employees from './pages/admin/Employees.jsx';
import Departments from './pages/admin/Departments.jsx';
import LeaveTypes from './pages/admin/LeaveTypes.jsx';
import OrgReports from './pages/admin/OrgReports.jsx';
import Settings from './pages/admin/Settings.jsx';

function Guard({ allow, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow(user)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="apply" element={<ApplyLeave />} />
        <Route path="my-leaves" element={<MyLeaves />} />
        <Route path="calendar" element={<TeamCalendar />} />
        <Route path="profile" element={<Profile />} />
        <Route path="approvals" element={<Guard allow={isApprover}><Approvals /></Guard>} />
        <Route path="team-balances" element={<Guard allow={isApprover}><TeamBalances /></Guard>} />
        <Route path="team-reports" element={<Guard allow={isApprover}><TeamReports /></Guard>} />
        <Route path="admin/employees" element={<Guard allow={isAdmin}><Employees /></Guard>} />
        <Route path="admin/departments" element={<Guard allow={isAdmin}><Departments /></Guard>} />
        <Route path="admin/leave-types" element={<Guard allow={isAdmin}><LeaveTypes /></Guard>} />
        <Route path="admin/reports" element={<Guard allow={isAdmin}><OrgReports /></Guard>} />
        <Route path="admin/settings" element={<Guard allow={isAdmin}><Settings /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
