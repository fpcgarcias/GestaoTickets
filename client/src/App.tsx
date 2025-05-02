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
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "./hooks/use-auth";

function AppContent() {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen flex">
      <Sidebar currentPath={location} />
      <div className="flex-1 flex flex-col">
        <Header />
        <div className="flex-1 overflow-auto p-6 bg-neutral-50">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/tickets" component={TicketsIndex} />
            <Route path="/tickets/new" component={NewTicket} />
            <Route path="/tickets/:id" component={TicketDetail} />
            <Route path="/users" component={UsersIndex} />
            <Route path="/officials" component={OfficialsIndex} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </div>
    </div>
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
