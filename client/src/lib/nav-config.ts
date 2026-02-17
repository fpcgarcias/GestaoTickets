import { LucideIcon } from 'lucide-react';
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
  ArrowLeftRight,
  ClipboardList,
  Handshake,
  MapPin,
  FileSpreadsheet,
  Layers,
  Network,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  roles: string[];
}

export interface InventoryNavItem {
  href: string;
  icon: LucideIcon;
  labelKey: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: LayoutDashboard, labelKey: 'sidebar.dashboard', roles: ['admin', 'support', 'customer', 'company_admin', 'manager', 'supervisor', 'viewer'] },
  { href: "/tickets", icon: TicketIcon, labelKey: 'sidebar.tickets', roles: ['admin', 'support', 'customer', 'company_admin', 'manager', 'supervisor', 'viewer'] },
  { href: "/users", icon: Users, labelKey: 'people.title', roles: ['admin', 'company_admin', 'manager', 'supervisor', 'support'] },
  { href: "/reports", icon: PieChart, labelKey: 'sidebar.reports', roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
  { href: "/companies", icon: Building2, labelKey: 'sidebar.companies', roles: ['admin'] },
  { href: "/permissions", icon: Shield, labelKey: 'sidebar.permissions', roles: ['admin'] },
  { href: "/departments", icon: FolderIcon, labelKey: 'sidebar.departments', roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
  { href: "/sectors", icon: Network, labelKey: 'sidebar.sectors', roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
  { href: "/service-providers", icon: Briefcase, labelKey: 'sidebar.service_providers', roles: ['admin', 'company_admin', 'manager', 'supervisor', 'support'] },
  { href: "/ticket-types", icon: TagIcon, labelKey: 'sidebar.ticket_types', roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
  { href: "/categories", icon: Grid3X3, labelKey: 'sidebar.categories', roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
  { href: "/priority-settings", icon: Palette, labelKey: 'sidebar.priorities', roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
  { href: "/sla-configurations", icon: Clock, labelKey: 'sidebar.sla_configurations', roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
  { href: "/sla-dashboard", icon: BarChart3, labelKey: 'sidebar.sla_dashboard', roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
  { href: "/satisfaction-dashboard", icon: Star, labelKey: 'sidebar.satisfaction_dashboard', roles: ['admin', 'company_admin', 'manager', 'supervisor'] },
  { href: "/performance-dashboard", icon: BarChart3, labelKey: 'sidebar.performance_dashboard', roles: ['admin'] },
  { href: "/ai-audit", icon: Brain, labelKey: 'sidebar.ai_audit', roles: ['admin', 'company_admin'] },
  { href: "/logs", icon: FileText, labelKey: 'sidebar.logs', roles: ['admin'] },
  { href: "/settings", icon: Settings, labelKey: 'sidebar.settings', roles: ['admin', 'company_admin', 'manager', 'supervisor', 'support', 'viewer'] },
];

export const INVENTORY_ITEMS: InventoryNavItem[] = [
  { href: "/inventory", icon: LayoutDashboard, labelKey: 'sidebar.inventory_overview' },
  { href: "/inventory/catalog", icon: Boxes, labelKey: 'sidebar.inventory_catalog' },
  { href: "/inventory/movements", icon: ArrowLeftRight, labelKey: 'sidebar.inventory_movements' },
  { href: "/inventory/assignments", icon: ClipboardList, labelKey: 'sidebar.inventory_assignments' },
  { href: "/inventory/suppliers", icon: Handshake, labelKey: 'sidebar.inventory_suppliers' },
  { href: "/inventory/product-types", icon: Layers, labelKey: 'sidebar.inventory_product_types' },
  { href: "/inventory/product-categories", icon: Tag, labelKey: 'sidebar.inventory_product_categories' },
  { href: "/inventory/locations", icon: MapPin, labelKey: 'sidebar.inventory_locations' },
  { href: "/inventory/reports", icon: FileSpreadsheet, labelKey: 'sidebar.inventory_reports' },
  { href: "/inventory/webhooks", icon: Network, labelKey: 'sidebar.inventory_webhooks' },
  { href: "/inventory/term-templates", icon: FileText, labelKey: 'sidebar.inventory_term_templates' },
];

export const INVENTORY_ROLES = ['admin', 'company_admin', 'manager', 'supervisor', 'support', 'inventory_manager'];

export function filterNavItems(items: NavItem[], userRole: string): NavItem[] {
  return items.filter(item => item.roles.includes(userRole));
}
