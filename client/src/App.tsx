import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "./hooks/use-auth";
import { ThemeProvider } from "./contexts/theme-context";
import { WebSocketProvider } from "./contexts/websocket-context";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { IntlProvider } from "react-intl";
import { detectLocaleFromDomain, messages } from "./i18n";
import { PWAInstaller } from "@/components/PWAInstaller";

// Lazy loading das páginas principais
const Dashboard = lazy(() => import("@/pages/dashboard"));
const TicketsIndex = lazy(() => import("@/pages/tickets/index"));
const NewTicket = lazy(() => import("@/pages/tickets/new"));
const TicketDetail = lazy(() => import("@/pages/tickets/[id]"));
const UsersIndex = lazy(() => import("@/pages/users/index"));
const OfficialsIndex = lazy(() => import("@/pages/officials/index"));
const ClientsIndex = lazy(() => import("@/pages/clients/index"));
const CompaniesIndex = lazy(() => import("@/pages/companies/index"));
const DepartmentManagement = lazy(() => import("@/pages/DepartmentManagement"));
const TicketTypeManagement = lazy(() => import("@/pages/TicketTypeManagement"));
const CategoryManagement = lazy(() => import("@/pages/CategoryManagement"));
const Settings = lazy(() => import("@/pages/settings"));
const PrioritySettings = lazy(() => import("@/pages/priority-settings"));
const SLAConfigurations = lazy(() => import("@/pages/sla-configurations"));
const SLADashboardPage = lazy(() => import("@/pages/sla-dashboard"));
const PermissionsPage = lazy(() => import("@/pages/permissions"));
const Changelog = lazy(() => import("@/pages/changelog"));
const PerformanceDashboard = lazy(() => import("@/pages/performance-dashboard"));
const LogsPage = lazy(() => import("@/pages/logs"));
const AiAuditPage = lazy(() => import("@/pages/ai-audit"));
const ReportsIndex = lazy(() => import("@/pages/reports/index"));
const TicketReports = lazy(() => import("@/pages/reports/TicketReports"));
const PerformanceReports = lazy(() => import("@/pages/reports/performance"));
const SLAReports = lazy(() => import("@/pages/reports/sla"));
const DepartmentReports = lazy(() => import("@/pages/reports/department"));
const ClientReports = lazy(() => import("@/pages/reports/clients"));
const SatisfactionSurvey = lazy(() => import("@/pages/satisfaction-survey"));
const SatisfactionDashboard = lazy(() => import("@/pages/satisfaction-dashboard"));

// Componente de loading para as páginas lazy
function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors">
      <Sidebar currentPath={location} />
      <div className="flex-1 flex flex-col">
        <Header />
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-muted/30 pb-20 md:pb-6 transition-colors">
          <Suspense fallback={<PageLoading />}>
            {children}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  
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

      <ProtectedRoute path="/reports" component={() => (
                  <MainLayout>
                    <ReportsIndex />
                  </MainLayout>
                )} />
                <ProtectedRoute path="/reports/tickets" component={() => (
                  <MainLayout>
                    <TicketReports />
                  </MainLayout>
                )} />
                <ProtectedRoute path="/reports/performance" component={() => (
                  <MainLayout>
                    <PerformanceReports />
                  </MainLayout>
                )} />
                <ProtectedRoute path="/reports/sla" component={() => (
                  <MainLayout>
                    <SLAReports />
                  </MainLayout>
                )} />
                <ProtectedRoute path="/reports/department" component={() => (
                  <MainLayout>
                    <DepartmentReports />
                  </MainLayout>
                )} />
                <ProtectedRoute path="/reports/clients" component={() => (
                  <MainLayout>
                    <ClientReports />
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
      
      <ProtectedRoute path="/categories" component={() => (
        <MainLayout>
          <CategoryManagement />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/settings" component={() => (
        <MainLayout>
          <Settings />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/priority-settings" component={() => (
        <MainLayout>
          <PrioritySettings />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/sla-configurations" component={() => (
        <MainLayout>
          <SLAConfigurations />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/sla-dashboard" component={() => (
        <MainLayout>
          <SLADashboardPage />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/customers" component={() => (
        <MainLayout>
          <ClientsIndex />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/performance-dashboard" component={() => (
        <MainLayout>
          <PerformanceDashboard />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/logs" component={() => (
        <MainLayout>
          <LogsPage />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/ai-audit" component={() => (
        <MainLayout>
          <AiAuditPage />
        </MainLayout>
      )} />
      
      <ProtectedRoute path="/satisfaction-dashboard" component={() => (
        <MainLayout>
          <SatisfactionDashboard />
        </MainLayout>
      )} />
      
      {/* Rota pública - Changelog */}
      <Route path="/changelog" component={() => (
        <MainLayout>
          <Changelog />
        </MainLayout>
      )} />
      
      {/* Rota pública - Pesquisa de Satisfação */}
      <Route path="/satisfaction/:token" component={() => (
        <SatisfactionSurvey />
      )} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const locale = detectLocaleFromDomain();
  const localeMessages = messages[locale];
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WebSocketProvider>
            <ThemeProvider>
              <IntlProvider locale={locale} messages={localeMessages}>
                <Toaster />
                <PWAInstaller />
                <AppContent />
              </IntlProvider>
            </ThemeProvider>
          </WebSocketProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
