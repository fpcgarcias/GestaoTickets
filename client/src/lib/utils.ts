import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function generateTicketId(): string {
  const year = new Date().getFullYear();
  const letters = 'CS';
  const numbers = Math.floor(Math.random() * 9000) + 1000;
  return `${year}-${letters}${numbers}`;
}

export const TICKET_STATUS = {
  NEW: 'new',
  ONGOING: 'ongoing',
  RESOLVED: 'resolved'
};

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const PRIORITY_COLORS = {
  [PRIORITY_LEVELS.LOW]: 'bg-blue-200 text-blue-800',
  [PRIORITY_LEVELS.MEDIUM]: 'bg-yellow-200 text-yellow-800',
  [PRIORITY_LEVELS.HIGH]: 'bg-red-500 text-white',
  [PRIORITY_LEVELS.CRITICAL]: 'bg-red-800 text-white'
};

export const STATUS_COLORS = {
  [TICKET_STATUS.NEW]: 'bg-status-new',
  [TICKET_STATUS.ONGOING]: 'bg-status-ongoing',
  [TICKET_STATUS.RESOLVED]: 'bg-status-resolved'
};

export const TICKET_TYPES = [
  { value: 'technical', label: 'Technical Support' },
  { value: 'account', label: 'Account Issue' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'deposit', label: 'Deposit Issue' }
];
