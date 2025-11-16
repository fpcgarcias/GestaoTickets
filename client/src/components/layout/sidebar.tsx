import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useVersion } from '@/hooks/use-version';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useI18n } from '@/i18n';
import { Link } from 'wouter';
import { 
  LayoutDashboard, 
  TicketIcon, 
  Users, 
  UserCog, 
  Settings,
  Building2,
  FolderIcon,
  TagIcon,
  Tag,
  Menu,
  LogOut,
  Shield,
  Palette,
  Clock,
  BarChart3,
  Grid3X3,
  FileText,
  Brain,
  PieChart,
  Star,
  Briefcase,
  Boxes,
  ChevronDown,
  ChevronRight,
  Package,
  ArrowLeftRight,
  ClipboardList,
  Handshake,
  MapPin,
  FileSpreadsheet,
  Layers,
  Network,
} from "lucide-react";
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarProps {
  currentPath: string;
}

const SidebarItem = ({ href, icon, label, isActive }: { 
  href: string; 
  icon: React.ReactNode; 
  label: string;
  isActive: boolean;
}) => {
  return (
    <Link href={href}>
      <div className={cn(
        "sidebar-item flex items-center px-4 py-3 rounded-md mb-1 cursor-pointer transition-colors",
        isActive 
          ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}>
        <span className="mr-3 text-lg">{icon}</span>
        <span className={cn("text-sm font-medium", isActive ? "text-sidebar-accent-foreground" : "text-inherit")}>
          {label}
        </span>
      </div>
    </Link>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentPath }) => {
  const { user, logout } = useAuth();
  const { currentVersion } = useVersion();
  const { formatMessage } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Usar o tema do contexto (executa apenas uma vez)
  const { companyName, companyLogo } = useTheme();
  
  const inventoryRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support', 'inventory_manager'];
  const canAccessInventory = !!user && inventoryRoles.includes(user.role);

  const inventoryMenuItems = useMemo(() => [
    { href: "/inventory", icon: <LayoutDashboard size={18} />, label: formatMessage('sidebar.inventory_overview') },
    { href: "/inventory/catalog", icon: <Boxes size={18} />, label: formatMessage('sidebar.inventory_catalog') },
    { href: "/inventory/movements", icon: <ArrowLeftRight size={18} />, label: formatMessage('sidebar.inventory_movements') },
    { href: "/inventory/assignments", icon: <ClipboardList size={18} />, label: formatMessage('sidebar.inventory_assignments') },
    { href: "/inventory/suppliers", icon: <Handshake size={18} />, label: formatMessage('sidebar.inventory_suppliers') },
    { href: "/inventory/product-types", icon: <Layers size={18} />, label: formatMessage('sidebar.inventory_product_types') },
    { href: "/inventory/product-categories", icon: <Tag size={18} />, label: formatMessage('sidebar.inventory_product_categories') },
    { href: "/inventory/locations", icon: <MapPin size={18} />, label: formatMessage('sidebar.inventory_locations') },
    { href: "/inventory/reports", icon: <FileSpreadsheet size={18} />, label: formatMessage('sidebar.inventory_reports') },
    { href: "/inventory/webhooks", icon: <Network size={18} />, label: formatMessage('sidebar.inventory_webhooks') },
  ], [formatMessage]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(currentPath.startsWith("/inventory"));

  useEffect(() => {
    if (currentPath.startsWith("/inventory")) {
      setIsInventoryOpen(true);
    }
  }, [currentPath]);
  
  // Definir itens de navegação com base no papel do usuário
  const navItems = [
    { href: "/", icon: <LayoutDashboard size={20} />, label: formatMessage('sidebar.dashboard'), roles: ['admin', 'support', 'customer', 'company_admin', 'manager', 'supervisor', 'viewer'] },
    { href: "/tickets", icon: <TicketIcon size={20} />, label: formatMessage('sidebar.tickets'), roles: ['admin', 'support', 'customer', 'company_admin', 'manager', 'supervisor', 'viewer'] },
    { href: "/clients", icon: <Users size={20} />, label: formatMessage('sidebar.clients'), roles: ['admin', 'support', 'company_admin', 'manager', 'supervisor'] },
    { href: "/users", icon: <Users size={20} />, label: formatMessage('sidebar.users'), roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/officials", icon: <UserCog size={20} />, label: formatMessage('sidebar.officials'), roles: ['admin', 'company_admin', 'manager', 'supervisor', 'support'] },
    { href: "/reports", icon: <PieChart size={20} />, label: formatMessage('sidebar.reports'), roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/companies", icon: <Building2 size={20} />, label: formatMessage('sidebar.companies'), roles: ['admin'] },
    { href: "/permissions", icon: <Shield size={20} />, label: formatMessage('sidebar.permissions'), roles: ['admin'] },
    { href: "/departments", icon: <FolderIcon size={20} />, label: formatMessage('sidebar.departments'), roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/service-providers", icon: <Briefcase size={20} />, label: formatMessage('sidebar.service_providers'), roles: ['admin', 'company_admin', 'manager', 'supervisor', 'support'] },
    { href: "/ticket-types", icon: <TagIcon size={20} />, label: formatMessage('sidebar.ticket_types'), roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/categories", icon: <Grid3X3 size={20} />, label: formatMessage('sidebar.categories'), roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/priority-settings", icon: <Palette size={20} />, label: formatMessage('sidebar.priorities'), roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/sla-configurations", icon: <Clock size={20} />, label: formatMessage('sidebar.sla_configurations'), roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/sla-dashboard", icon: <BarChart3 size={20} />, label: formatMessage('sidebar.sla_dashboard'), roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/satisfaction-dashboard", icon: <Star size={20} />, label: formatMessage('sidebar.satisfaction_dashboard'), roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/performance-dashboard", icon: <BarChart3 size={20} />, label: formatMessage('sidebar.performance_dashboard'), roles: ['admin'] },
    { href: "/ai-audit", icon: <Brain size={20} />, label: formatMessage('sidebar.ai_audit'), roles: ['admin', 'company_admin'] },
    { href: "/logs", icon: <FileText size={20} />, label: formatMessage('sidebar.logs'), roles: ['admin'] },
    { href: "/settings", icon: <Settings size={20} />, label: formatMessage('sidebar.settings'), roles: ['admin', 'company_admin', 'manager', 'supervisor', 'support', 'viewer'] },
  ];
  
  // Filtrar itens de navegação com base no papel do usuário atual
  const filteredNavItems = navItems.filter(item => {
    if (!user || !item.roles) return false;
    return item.roles.includes(user.role);
  });

  const mobileNavItems = filteredNavItems.flatMap((item) => {
    if (canAccessInventory && item.href === "/tickets") {
      return [
        item,
        { href: "/inventory", icon: <Boxes size={20} />, label: formatMessage('sidebar.inventory'), roles: inventoryRoles },
      ];
    }
    return [item];
  });

  return (
    <>
      {/* Versão desktop da barra lateral */}
      <div className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-shrink-0 hidden md:flex md:flex-col h-screen transition-colors">
        <div className="p-6 border-b border-sidebar-border">
          {companyLogo ? (
            <div className="flex justify-center">
              <img 
                src={companyLogo} 
                alt={companyName} 
                className="h-10 w-auto max-w-[180px] object-contain"
                style={{ maxHeight: '40px' }}
              />
            </div>
          ) : (
            <h1 className="text-xl font-semibold text-sidebar-foreground">{companyName}</h1>
          )}
        </div>
        <nav className="p-4 flex-1 overflow-y-auto">
          {filteredNavItems.map((item, index) => {
            const sidebarEntry = (
            <SidebarItem 
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={
                item.href === "/" 
                  ? currentPath === "/" 
                  : currentPath.startsWith(item.href)
              }
            />
            );

            if (canAccessInventory && item.href === "/tickets") {
              return (
                <React.Fragment key={item.href}>
                  {sidebarEntry}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setIsInventoryOpen((prev) => !prev)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-4 py-3 text-sm font-medium transition-colors",
                        currentPath.startsWith("/inventory")
                          ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Boxes size={20} />
                        {formatMessage('sidebar.inventory')}
                      </span>
                      {isInventoryOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div
                      className={cn(
                        "mt-2 space-y-1 overflow-hidden rounded-md border border-sidebar-border/40 bg-sidebar/40 transition-all",
                        isInventoryOpen ? "max-h-[600px] p-2" : "max-h-0 p-0"
                      )}
                    >
                      {isInventoryOpen &&
                        inventoryMenuItems.map((item) => {
                          const active =
                            item.href === "/inventory"
                              ? currentPath === "/inventory"
                              : currentPath.startsWith(item.href);
                          return (
                            <Link key={item.href} href={item.href}>
                              <div
                                className={cn(
                                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                                  active
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                )}
                              >
                                {item.icon}
                                {item.label}
                              </div>
                            </Link>
                          );
                        })}
                    </div>
                  </div>
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={item.href}>
                {sidebarEntry}
              </React.Fragment>
            );
          })}
        </nav>
        
        {/* Versão do Sistema - Fixo no final */}
        <div className="p-4 border-t border-sidebar-border mt-auto">
          <Link href="/changelog">
            <div className="text-xs text-muted-foreground hover:text-sidebar-foreground cursor-pointer transition-colors">
              {formatMessage('sidebar.version')} {currentVersion}
            </div>
          </Link>
        </div>
      </div>
      
      {/* Versão mobile da barra lateral (visível apenas em telas pequenas) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar/95 backdrop-blur-sm border-t border-sidebar-border text-sidebar-foreground md:hidden transition-colors">
        <nav className="flex justify-around p-2 overflow-x-auto">
          {mobileNavItems.slice(0, 5).map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center p-2 rounded-md min-w-0 flex-shrink-0",
                (item.href === "/" 
                  ? currentPath === "/" 
                  : currentPath.startsWith(item.href))
                ? "text-sidebar-primary bg-sidebar-primary/15" 
                : "text-muted-foreground hover:text-sidebar-primary hover:bg-sidebar-accent/60"
              )}
            >
              {item.icon}
              <span className="text-[10px] mt-1 leading-tight text-center truncate">
                {item.label.split(' ')[0]}
              </span>
            </Link>
          ))}
          {filteredNavItems.length > 5 && (
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex flex-col items-center p-2 min-w-0 flex-shrink-0 h-auto text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                >
                  <Menu className="h-5 w-5" />
                  <span className='text-[10px] mt-1'>{formatMessage('sidebar.more')}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
                <div className="p-6 border-b border-sidebar-border">
                  {companyLogo ? (
                    <div className="flex justify-center">
                      <img 
                        src={companyLogo} 
                        alt={companyName} 
                        className="h-8 w-auto max-w-[160px] object-contain"
                        style={{ maxHeight: '32px' }}
                      />
                    </div>
                  ) : (
                    <h2 className="text-lg font-semibold text-sidebar-foreground">{companyName}</h2>
                  )}
                </div>
                <ScrollArea className="flex-1">
                  <nav className="grid gap-1 px-2 py-4">
                    {filteredNavItems.map((item, index) => (
                      <Link
                        key={index}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          (item.href === "/" 
                            ? currentPath === "/" 
                            : currentPath.startsWith(item.href))
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm' 
                          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    ))}
                    {canAccessInventory && (
                      <div className="mt-4 space-y-1">
                        <p className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wide">Inventário</p>
                        {inventoryMenuItems.map((item) => {
                          const active =
                            item.href === "/inventory"
                              ? currentPath === "/inventory"
                              : currentPath.startsWith(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                active
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                              )}
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              {item.icon}
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </nav>
                </ScrollArea>
                <div className="mt-auto p-4 border-t border-sidebar-border">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {formatMessage('sidebar.logout')}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </nav>
      </div>
    </>
  );
};
