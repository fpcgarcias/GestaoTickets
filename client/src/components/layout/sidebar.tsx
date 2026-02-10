import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useVersion } from '@/hooks/use-version';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useI18n } from '@/i18n';
import { Link } from 'wouter';
import { 
  Menu,
  LogOut,
  Boxes,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NAV_ITEMS, INVENTORY_ITEMS, INVENTORY_ROLES, filterNavItems } from '@/lib/nav-config';

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
  
  const canAccessInventory = !!user && INVENTORY_ROLES.includes(user.role);

  const inventoryMenuItems = useMemo(() => 
    INVENTORY_ITEMS.map(item => ({
      href: item.href,
      icon: <item.icon size={18} />,
      label: formatMessage(item.labelKey)
    })),
    [formatMessage]
  );
  
  const [isInventoryOpen, setIsInventoryOpen] = useState(currentPath.startsWith("/inventory"));

  useEffect(() => {
    if (currentPath.startsWith("/inventory")) {
      setIsInventoryOpen(true);
    }
  }, [currentPath]);
  
  // Filtrar itens de navegação com base no papel do usuário atual
  const filteredNavItems = useMemo(() => {
    if (!user) return [];
    return filterNavItems(NAV_ITEMS, user.role).map(item => ({
      href: item.href,
      icon: <item.icon size={20} />,
      label: formatMessage(item.labelKey),
      roles: item.roles
    }));
  }, [user, formatMessage]);

  const mobileNavItems = useMemo(() => {
    return filteredNavItems.flatMap((item) => {
      if (canAccessInventory && item.href === "/tickets") {
        return [
          item,
          { href: "/inventory", icon: <Boxes size={20} />, label: formatMessage('sidebar.inventory'), roles: INVENTORY_ROLES },
        ];
      }
      return [item];
    });
  }, [filteredNavItems, canAccessInventory, formatMessage]);

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
