import { Route, Routes } from 'react-router-dom';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import TicketsListPage from './pages/TicketsList';
import NewTicketPage from './pages/NewTicket';
import TicketDetailsPage from './pages/TicketDetails';
import SettingsPage from './pages/Settings';
import CompaniesPage from './pages/Companies';
import CompanyDetailsPage from './pages/CompanyDetails';
import UsersPage from './pages/Users';
import UserDetailsPage from './pages/UserDetails';
import TicketTypeManagement from './pages/TicketTypeManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import ProfilePage from './pages/Profile';
import NotFoundPage from './pages/NotFound';
import AuthLayout from './components/layouts/AuthLayout';
import DashboardLayout from './components/layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './hooks/use-auth';
import OfficialsPage from './pages/Officials';
import OfficialDetailsPage from './pages/OfficialDetails';
import CustomersPage from './pages/Customers';
import CustomerDetailsPage from './pages/CustomerDetails';
import PerformanceDashboard from './pages/performance-dashboard';

const AppRoutes = () => {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tickets" element={<TicketsListPage />} />
        <Route path="/tickets/new" element={<NewTicketPage />} />
        <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        
        {/* Gerenciamento de Tipos de Chamado */}
        <Route path="/ticket-types" element={<TicketTypeManagement />} />
        
        {/* Gerenciamento de Departamentos */}
        <Route path="/departments" element={<DepartmentManagement />} />
        
        {/* Rotas administrativas */}
        {user?.role === 'admin' && (
          <>
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/companies/:id" element={<CompanyDetailsPage />} />
          </>
        )}
        
        {/* Rotas de gestão de usuários (admin e company_admin) */}
        {(user?.role === 'admin' || user?.role === 'company_admin') && (
          <>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:id" element={<UserDetailsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailsPage />} />
          </>
        )}
        
        {/* Rotas de gestão de atendentes (admin, company_admin, manager, supervisor, support) */}
        {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor' || user?.role === 'support') && (
          <>
            <Route path="/officials" element={<OfficialsPage />} />
            <Route path="/officials/:id" element={<OfficialDetailsPage />} />
          </>
        )}
        
        {/* Rota de dashboard de performance - apenas admin */}
        {user?.role === 'admin' && (
          <Route path="/performance-dashboard" element={
            <ProtectedRoute>
              <PerformanceDashboard />
            </ProtectedRoute>
          } />
        )}
        
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes; 