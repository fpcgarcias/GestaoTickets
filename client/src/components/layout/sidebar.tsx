import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useVersion } from '@/hooks/use-version';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
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
  Menu,
  LogOut,
  Shield,
  Palette,
  Clock,
  BarChart3,
  Grid3X3
} from 'lucide-react';
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
        "sidebar-item flex items-center px-4 py-3 rounded-md mb-1 cursor-pointer",
        isActive 
          ? "active" 
          : "text-neutral-700 hover:bg-neutral-100"
      )}>
        <span className="mr-3 text-lg">{icon}</span>
        <span className={isActive ? "font-medium" : ""}>{label}</span>
      </div>
    </Link>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentPath }) => {
  const { user, logout } = useAuth();
  const { currentVersion } = useVersion();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Usar o tema do contexto (executa apenas uma vez)
  const { companyName, companyLogo } = useTheme();
  
  // Definir itens de navegação com base no papel do usuário
  const navItems = [
    { href: "/", icon: <LayoutDashboard size={20} />, label: "Painel de Controle", roles: ['admin', 'support', 'customer', 'company_admin', 'manager', 'supervisor', 'viewer'] },
    { href: "/tickets", icon: <TicketIcon size={20} />, label: "Chamados", roles: ['admin', 'support', 'customer', 'company_admin', 'manager', 'supervisor', 'viewer'] },
    { href: "/clients", icon: <Users size={20} />, label: "Clientes", roles: ['admin', 'support', 'company_admin', 'manager', 'supervisor'] },
    { href: "/users", icon: <Users size={20} />, label: "Usuários", roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/officials", icon: <UserCog size={20} />, label: "Atendentes", roles: ['admin', 'company_admin', 'manager', 'supervisor', 'support'] },
    { href: "/companies", icon: <Building2 size={20} />, label: "Empresas", roles: ['admin'] },
    { href: "/permissions", icon: <Shield size={20} />, label: "Permissões", roles: ['admin'] },
    { href: "/departments", icon: <FolderIcon size={20} />, label: "Departamentos", roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/ticket-types", icon: <TagIcon size={20} />, label: "Tipos de Chamado", roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/categories", icon: <Grid3X3 size={20} />, label: "Categorias", roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/priority-settings", icon: <Palette size={20} />, label: "Prioridades", roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/sla-configurations", icon: <Clock size={20} />, label: "Configurações SLA", roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/sla-dashboard", icon: <BarChart3 size={20} />, label: "Dashboard SLA", roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
    { href: "/settings", icon: <Settings size={20} />, label: "Configurações", roles: ['admin', 'company_admin', 'manager', 'supervisor', 'support', 'viewer'] },
  ];
  
  // Filtrar itens de navegação com base no papel do usuário atual
  const filteredNavItems = navItems.filter(item => {
    if (!user || !item.roles) return false;
    return item.roles.includes(user.role);
  });

  return (
    <>
      {/* Versão desktop da barra lateral */}
      <div className="w-64 bg-white border-r border-neutral-200 flex-shrink-0 hidden md:flex md:flex-col h-screen">
        <div className="p-6 border-b border-neutral-200">
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
            <h1 className="text-xl font-semibold text-neutral-900">{companyName}</h1>
          )}
        </div>
        <nav className="p-4 flex-1 overflow-y-auto">
          {filteredNavItems.map((item) => (
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
          ))}
        </nav>
        
        {/* Versão do Sistema - Fixo no final */}
        <div className="p-4 border-t border-neutral-200 mt-auto">
          <Link href="/changelog">
            <div className="text-xs text-neutral-500 hover:text-neutral-700 cursor-pointer transition-colors">
              Versão {currentVersion}
            </div>
          </Link>
        </div>
      </div>
      
      {/* Versão mobile da barra lateral (visível apenas em telas pequenas) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 md:hidden">
        <nav className="flex justify-around p-2 overflow-x-auto">
          {filteredNavItems.slice(0, 5).map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center p-2 rounded-md min-w-0 flex-shrink-0",
                (item.href === "/" 
                  ? currentPath === "/" 
                  : currentPath.startsWith(item.href))
                ? "text-primary bg-primary/10" 
                : "text-neutral-700 hover:text-primary hover:bg-neutral-100"
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
                  className="flex flex-col items-center p-2 min-w-0 flex-shrink-0 h-auto"
                >
                  <Menu className="h-5 w-5" />
                  <span className="text-[10px] mt-1">Mais</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <div className="p-6 border-b border-neutral-200">
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
                    <h2 className="text-lg font-semibold">{companyName}</h2>
                  )}
                </div>
                <ScrollArea className="flex-1">
                  <nav className="grid gap-1 px-2 py-4">
                    {filteredNavItems.map((item, index) => (
                      <Link
                        key={index}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
                          (item.href === "/" 
                            ? currentPath === "/" 
                            : currentPath.startsWith(item.href))
                          ? 'bg-accent text-accent-foreground' 
                          : 'text-muted-foreground'
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                </ScrollArea>
                <div className="mt-auto p-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
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
