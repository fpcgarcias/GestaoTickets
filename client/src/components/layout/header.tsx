import React, { useState } from 'react';
import { ChevronDown, Menu, User, Settings, LogOut, LayoutDashboard, TicketIcon, UserCog, Building2, FolderIcon, TagIcon } from 'lucide-react';
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

export const Header: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();

  const { user, logout } = useAuth();
  
  // Usar o nome da empresa dos dados do usuário logado
  const companyName = user?.company?.name || 'Ticket Wise';
  
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

  // Função para navegar para perfil
  const goToProfile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Redirecionar para perfil (ou settings por enquanto)
    setLocation('/settings');
    // Fechar dropdown após clicar
    const closeDropdown = document.querySelector('[data-radix-dropdown-menu-content-close]');
    if (closeDropdown) {
      (closeDropdown as HTMLElement).click();
    }
  };

  return (
    <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6">
      <div className="flex items-center">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden mr-4 text-neutral-700">
              <Menu />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <div className="p-6 border-b border-neutral-200">
              <h1 className="text-xl font-semibold text-neutral-900">{companyName}</h1>
            </div>
            <div className="flex-1 overflow-y-auto">
              <nav className="p-4 space-y-1">
              <Link href="/" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer ${location === "/" ? "active" : "text-neutral-700 hover:bg-neutral-100"}`}>
                <span className="mr-3 text-lg"><LayoutDashboard size={20} /></span>
                <span className={location === "/" ? "font-medium" : ""}>Painel de Controle</span>
              </Link>
              <Link href="/tickets" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer ${location.startsWith("/tickets") ? "active" : "text-neutral-700 hover:bg-neutral-100"}`}>
                <span className="mr-3 text-lg"><TicketIcon size={20} /></span>
                <span className={location.startsWith("/tickets") ? "font-medium" : ""}>Chamados</span>
              </Link>
              <Link href="/clients" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer ${location.startsWith("/clients") ? "active" : "text-neutral-700 hover:bg-neutral-100"}`}>
                <span className="mr-3 text-lg"><User size={20} /></span>
                <span className={location.startsWith("/clients") ? "font-medium" : ""}>Clientes</span>
              </Link>
              <Link href="/users" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer ${location.startsWith("/users") ? "active" : "text-neutral-700 hover:bg-neutral-100"}`}>
                <span className="mr-3 text-lg"><User size={20} /></span>
                <span className={location.startsWith("/users") ? "font-medium" : ""}>Usuários</span>
              </Link>
              <Link href="/officials" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer ${location.startsWith("/officials") ? "active" : "text-neutral-700 hover:bg-neutral-100"}`}>
                <span className="mr-3 text-lg"><UserCog size={20} /></span>
                <span className={location.startsWith("/officials") ? "font-medium" : ""}>Atendentes</span>
              </Link>
                             <Link href="/companies" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer ${location.startsWith("/companies") ? "active" : "text-neutral-700 hover:bg-neutral-100"}`}>
                 <span className="mr-3 text-lg"><Building2 size={20} /></span>
                 <span className={location.startsWith("/companies") ? "font-medium" : ""}>Empresas</span>
               </Link>
               <Link href="/departments" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer ${location.startsWith("/departments") ? "active" : "text-neutral-700 hover:bg-neutral-100"}`}>
                 <span className="mr-3 text-lg"><FolderIcon size={20} /></span>
                 <span className={location.startsWith("/departments") ? "font-medium" : ""}>Departamentos</span>
               </Link>
               <Link href="/ticket-types" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer ${location.startsWith("/ticket-types") ? "active" : "text-neutral-700 hover:bg-neutral-100"}`}>
                 <span className="mr-3 text-lg"><TagIcon size={20} /></span>
                 <span className={location.startsWith("/ticket-types") ? "font-medium" : ""}>Tipos de Chamado</span>
               </Link>
                             <Link href="/settings" className={`sidebar-item flex items-center px-4 py-3 rounded-md cursor-pointer ${location.startsWith("/settings") ? "active" : "text-neutral-700 hover:bg-neutral-100"}`}>
                 <span className="mr-3 text-lg"><Settings size={20} /></span>
                 <span className={location.startsWith("/settings") ? "font-medium" : ""}>Configurações</span>
               </Link>
             </nav>
           </div>
           </SheetContent>
        </Sheet>
        <div className="text-neutral-800">Bem-vindo, {currentUser.name}!</div>
      </div>

      <div className="flex items-center">
        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 p-1 hover:bg-neutral-100 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                <AvatarFallback>{currentUser.initials || currentUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline-block">{currentUser.name}</span>
              <ChevronDown size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={goToProfile} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={goToSettings} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
