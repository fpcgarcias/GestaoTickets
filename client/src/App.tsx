import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import TicketsIndex from "@/pages/tickets/index";
import NewTicket from "@/pages/tickets/new";
import TicketDetail from "@/pages/tickets/[id]";
import UsersIndex from "@/pages/users/index";
import OfficialsIndex from "@/pages/officials/index";
import ClientsIndex from "@/pages/clients/index";
import CompaniesIndex from "@/pages/companies/index";
import DepartmentManagement from "@/pages/DepartmentManagement";
import TicketTypeManagement from "@/pages/TicketTypeManagement";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { useSystemSettings } from "@/hooks/use-system-settings";
import PermissionsPage from "@/pages/permissions";
import Changelog from "@/pages/changelog";

function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen flex">
      <Sidebar currentPath={location} />
      <div className="flex-1 flex flex-col">
        <Header />
        <div className="flex-1 overflow-auto p-6 bg-neutral-50 pb-20 md:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  
  // Definir título do documento usando o nome da empresa das configurações do sistema
  useEffect(() => {
    const companyName = settings.companyName;
    document.title = `${companyName} - Sistema de Gestão de Chamados`;
  }, [settings.companyName]);
  
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <ProtectedRoute path="/" component={() => (
        <MainLayout>
          <Dashboard />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/tickets" component={() => (
        <MainLayout>
          <TicketsIndex />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/tickets/new" component={() => (
        <MainLayout>
          <NewTicket />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/tickets/:id" component={() => (
        <MainLayout>
          <TicketDetail />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/clients" component={() => (
        <MainLayout>
          <ClientsIndex />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/users" component={() => (
        <MainLayout>
          <UsersIndex />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/officials" component={() => (
        <MainLayout>
          <OfficialsIndex />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/companies" component={() => (
        <MainLayout>
          <CompaniesIndex />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/permissions" component={() => (
        <MainLayout>
          <PermissionsPage />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/departments" component={() => (
        <MainLayout>
          <DepartmentManagement />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/ticket-types" component={() => (
        <MainLayout>
          <TicketTypeManagement />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/settings" component={() => (
        <MainLayout>
          <Settings />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/customers" component={() => (
        <MainLayout>
          <ClientsIndex />
        </MainLayout>
      )} />
      
      {/* Rota pública - Changelog */}
      <Route path="/changelog" component={() => (
        <MainLayout>
          <Changelog />
        </MainLayout>
      )} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
