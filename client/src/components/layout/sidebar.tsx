import React from 'react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { 
  LayoutDashboard, 
  Users, 
  TicketIcon, 
  UserCog, 
  Settings
} from 'lucide-react';

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
      <a className={cn(
        "sidebar-item flex items-center px-4 py-3 rounded-md mb-1 cursor-pointer",
        isActive 
          ? "active" 
          : "text-neutral-700 hover:bg-neutral-100"
      )}>
        <span className="mr-3 text-lg">{icon}</span>
        <span className={isActive ? "font-medium" : ""}>{label}</span>
      </a>
    </Link>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentPath }) => {
  const navItems = [
    { href: "/", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
    { href: "/users", icon: <Users size={20} />, label: "Users" },
    { href: "/tickets", icon: <TicketIcon size={20} />, label: "Tickets" },
    { href: "/officials", icon: <UserCog size={20} />, label: "Officials" },
    { href: "/settings", icon: <Settings size={20} />, label: "Site Settings" },
  ];

  return (
    <div className="w-64 bg-white border-r border-neutral-200 flex-shrink-0 hidden md:block">
      <div className="p-6 border-b border-neutral-200">
        <h1 className="text-xl font-semibold text-neutral-900">TICKET LEAD</h1>
      </div>
      <nav className="p-4">
        {navItems.map((item) => (
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
    </div>
  );
};
