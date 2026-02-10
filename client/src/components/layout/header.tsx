import React, { useState, useMemo } from 'react';
import { ChevronDown, Menu, User, Settings, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';
import { useI18n } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationCenter } from "@/components/layout/notification-center";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { NAV_ITEMS, filterNavItems } from '@/lib/nav-config';
import { cn } from '@/lib/utils';

export const Header: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const { formatMessage } = useI18n();

  const { user, logout } = useAuth();
  
  // Usar o nome da empresa baseado no tema/domínio
  const { companyName, themeName, mode, setMode, toggleMode } = useTheme();
  const isDarkToggleAvailable = themeName === 'default';
  
  // Use dados do usuário autenticado ou valores padrão
  const currentUser = user || {
    id: 1,
    name: "Usuário",
    email: "usuario@example.com",
    username: "usuario",
    role: "admin" as const,
    avatarUrl: "", 
    initials: "U"
  };

  // Filtrar itens de navegação com base no papel do usuário
  const filteredNavItems = useMemo(() => {
    if (!user) return [];
    return filterNavItems(NAV_ITEMS, user.role);
  }, [user]);

  // Função para fazer logout
  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      // Redirecionar para página de login
      setLocation('/auth');
    } catch (error) {
      toast({
        title: "Erro ao sair",
        description: "Não foi possível fazer logout.",
        variant: "destructive",
      });
    }
  };

  // Função para navegar para configurações
  const goToSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocation('/settings');
    // Fechar dropdown após clicar
    const closeDropdown = document.querySelector('[data-radix-dropdown-menu-content-close]');
    if (closeDropdown) {
      (closeDropdown as HTMLElement).click();
    }
  };

  return (
    <header className="h-16 bg-card text-card-foreground border-b border-border flex items-center justify-between px-6 transition-colors">
      <div className="flex items-center">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden mr-4 text-muted-foreground hover:bg-muted">
              <Menu />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
            <div className="p-6 border-b border-sidebar-border">
              <h1 className="text-xl font-semibold text-sidebar-foreground">{companyName}</h1>
            </div>
            <div className="flex-1 overflow-y-auto">
              <nav className="p-4 space-y-1">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.href === "/" 
                    ? location === "/" 
                    : location.startsWith(item.href);
                  
                  return (
                    <Link 
                      key={item.href}
                      href={item.href} 
                      className={cn(
                        "sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors",
                        isActive 
                          ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" 
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span className="mr-3 text-lg"><Icon size={20} /></span>
                      <span className={isActive ? "font-medium" : ""}>{formatMessage(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
        <div className="text-muted-foreground">{formatMessage('header.welcome', { name: currentUser.name })}</div>
      </div>

      <div className="flex items-center">
        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 p-1 rounded-full text-card-foreground hover:bg-muted">
              <Avatar className="h-9 w-9">
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                <AvatarFallback>{currentUser.initials || currentUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline-block">{currentUser.name}</span>
              <ChevronDown size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{formatMessage('header.my_account')}</DropdownMenuLabel>
            {isDarkToggleAvailable && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    toggleMode();
                  }}
                  className="cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    {mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    <span>{formatMessage('header.dark_mode')}</span>
                  </div>
                  <Switch
                    checked={mode === 'dark'}
                    onCheckedChange={(checked) => setMode(checked ? 'dark' : 'light')}
                    onClick={(event) => event.stopPropagation()}
                  />
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            {currentUser.role !== 'customer' && (
              <DropdownMenuItem onClick={goToSettings} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>{formatMessage('header.settings')}</span>
              </DropdownMenuItem>
            )}
            {currentUser.role !== 'customer' && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{formatMessage('header.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
