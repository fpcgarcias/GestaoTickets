import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home,
  Settings,
  Users,
  Ticket,
  Building2,
  LogOut,
  User,
  UserCog,
  Menu,
  FolderOpen,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';

const navItems = [
  { icon: Home, href: '/', title: 'Dashboard', roles: ['admin', 'customer', 'support', 'manager', 'company_admin', 'supervisor', 'viewer'] },
  { icon: Ticket, href: '/tickets', title: 'Chamados', roles: ['admin', 'customer', 'support', 'manager', 'company_admin', 'supervisor', 'viewer'] },
  { icon: FolderOpen, href: '/departments', title: 'Departamentos', roles: ['admin', 'company_admin', 'manager'] },
  { icon: Tag, href: '/ticket-types', title: 'Tipos de Chamado', roles: ['admin', 'company_admin', 'manager'] },
  { icon: Building2, href: '/companies', title: 'Empresas', roles: ['admin'] },
  { icon: Users, href: '/users', title: 'Usuários', roles: ['admin', 'company_admin'] },
  { icon: UserCog, href: '/officials', title: 'Atendentes', roles: ['admin', 'company_admin', 'manager'] },
  { icon: User, href: '/customers', title: 'Clientes', roles: ['admin', 'company_admin', 'support', 'manager', 'supervisor'] },
  { icon: Settings, href: '/settings', title: 'Configurações', roles: ['admin', 'company_admin'] },
];

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const filteredNavItems = navItems.filter((item) => {
    return user && item.roles.includes(user.role);
  });

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open Menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <Link to="/" className="text-lg font-semibold">
            Gestão de Chamados
          </Link>
          <div className="w-9" />
        </div>
        <SheetContent side="left" className="p-0 w-72">
          <MobileSidebar 
            navItems={filteredNavItems} 
            onLogout={handleLogout} 
            pathname={pathname} 
            closeMenu={() => setIsOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div
        className={cn(
          'hidden lg:flex flex-col h-screen w-64 border-r bg-white',
          className
        )}
      >
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Gestão de Chamados</h2>
        </div>
        <ScrollArea className="flex-1">
          <nav className="grid gap-1 px-2 py-4">
            {filteredNavItems.map((item, index) => (
              <Link
                key={index}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
                  pathname === item.href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            ))}
          </nav>
        </ScrollArea>
        <div className="mt-auto p-4 border-t">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </>
  );
}

interface MobileSidebarProps {
  navItems: typeof navItems;
  onLogout: () => void;
  pathname: string;
  closeMenu: () => void;
}

function MobileSidebar({ navItems, onLogout, pathname, closeMenu }: MobileSidebarProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Gestão de Chamados</h2>
      </div>
      <ScrollArea className="flex-1">
        <nav className="grid gap-1 px-2 py-4">
          {navItems.map((item, index) => (
            <Link
              key={index}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
                pathname === item.href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )}
              onClick={closeMenu}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          ))}
        </nav>
      </ScrollArea>
      <div className="mt-auto p-4 border-t">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
} 