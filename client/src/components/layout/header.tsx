import React, { useState } from 'react';
import { ChevronDown, Menu, User, Settings, LogOut, LayoutDashboard, TicketIcon, UserCog, Building2, FolderIcon, TagIcon, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';
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

export const Header: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();

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
              <Link href="/" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${location === "/" ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                <span className="mr-3 text-lg"><LayoutDashboard size={20} /></span>
                <span className={location === "/" ? "font-medium" : ""}>Painel de Controle</span>
              </Link>
              <Link href="/tickets" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${location.startsWith("/tickets") ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                <span className="mr-3 text-lg"><TicketIcon size={20} /></span>
                <span className={location.startsWith("/tickets") ? "font-medium" : ""}>Chamados</span>
              </Link>
              <Link href="/clients" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${location.startsWith("/clients") ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                <span className="mr-3 text-lg"><User size={20} /></span>
                <span className={location.startsWith("/clients") ? "font-medium" : ""}>Clientes</span>
              </Link>
              <Link href="/users" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${location.startsWith("/users") ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                <span className="mr-3 text-lg"><User size={20} /></span>
                <span className={location.startsWith("/users") ? "font-medium" : ""}>Usuários</span>
              </Link>
              <Link href="/officials" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${location.startsWith("/officials") ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                <span className="mr-3 text-lg"><UserCog size={20} /></span>
                <span className={location.startsWith("/officials") ? "font-medium" : ""}>Atendentes</span>
              </Link>
                             <Link href="/companies" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${location.startsWith("/companies") ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                 <span className="mr-3 text-lg"><Building2 size={20} /></span>
                 <span className={location.startsWith("/companies") ? "font-medium" : ""}>Empresas</span>
               </Link>
               <Link href="/departments" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${location.startsWith("/departments") ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                 <span className="mr-3 text-lg"><FolderIcon size={20} /></span>
                 <span className={location.startsWith("/departments") ? "font-medium" : ""}>Departamentos</span>
               </Link>
               <Link href="/ticket-types" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${location.startsWith("/ticket-types") ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                 <span className="mr-3 text-lg"><TagIcon size={20} /></span>
                 <span className={location.startsWith("/ticket-types") ? "font-medium" : ""}>Tipos de Chamado</span>
               </Link>
               {currentUser.role !== 'customer' && (
                 <Link href="/settings" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${location.startsWith("/settings") ? "active bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                   <span className="mr-3 text-lg"><Settings size={20} /></span>
                   <span className={location.startsWith("/settings") ? "font-medium" : ""}>Configurações</span>
                 </Link>
               )}
             </nav>
           </div>
           </SheetContent>
        </Sheet>
        <div className="text-muted-foreground">Bem-vindo, {currentUser.name}!</div>
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
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
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
                    <span>Modo escuro</span>
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
                <span>Configurações</span>
              </DropdownMenuItem>
            )}
            {currentUser.role !== 'customer' && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
