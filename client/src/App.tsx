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
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/hooks/use-auth";

function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen flex">
      <Sidebar currentPath={location} />
      <div className="flex-1 flex flex-col">
        <Header />
        <div className="flex-1 overflow-auto p-6 bg-neutral-50">
          {children}
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  
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
      
      <ProtectedRoute path="/settings" component={() => (
        <MainLayout>
          <Settings />
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
