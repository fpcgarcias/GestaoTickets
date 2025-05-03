var _a, _b;
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn() {
    var inputs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        inputs[_i] = arguments[_i];
    }
    return twMerge(clsx(inputs));
}
export function formatDate(date) {
    var d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }) + ' ' + d.toLocaleTimeString('pt-BR', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: false
    });
}
export function generateTicketId() {
    var year = new Date().getFullYear();
    var letters = 'CS';
    var numbers = Math.floor(Math.random() * 9000) + 1000;
    return "".concat(year, "-").concat(letters).concat(numbers);
}
export var TICKET_STATUS = {
    NEW: 'new',
    ONGOING: 'ongoing',
    RESOLVED: 'resolved'
};
export var PRIORITY_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};
export var PRIORITY_COLORS = (_a = {},
    _a[PRIORITY_LEVELS.LOW] = 'bg-blue-200 text-blue-800',
    _a[PRIORITY_LEVELS.MEDIUM] = 'bg-yellow-200 text-yellow-800',
    _a[PRIORITY_LEVELS.HIGH] = 'bg-red-500 text-white',
    _a[PRIORITY_LEVELS.CRITICAL] = 'bg-red-800 text-white',
    _a);
export var STATUS_COLORS = (_b = {},
    _b[TICKET_STATUS.NEW] = 'bg-status-new',
    _b[TICKET_STATUS.ONGOING] = 'bg-status-ongoing',
    _b[TICKET_STATUS.RESOLVED] = 'bg-status-resolved',
    _b);
export const TICKET_TYPES = [
    { id: 1, name: 'Problema Técnico', departmentId: 1 },
    { id: 2, name: 'Dúvida de Faturamento', departmentId: 2 },
    { id: 3, name: 'Pedido de Informação', departmentId: 3 },
    { id: 4, name: 'Reclamação', departmentId: 3 },
    { id: 5, name: 'Banco de Dados', departmentId: 1 }
];
export var DEPARTMENTS = [
    { id: 1, value: '1', label: 'Suporte Técnico', enumValue: 'technical' },
    { id: 2, value: '2', label: 'Faturamento', enumValue: 'billing' },
    { id: 3, value: '3', label: 'Atendimento ao Cliente', enumValue: 'general' }
];
export var PERIOD_OPTIONS = [
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: '7 dias' },
    { value: 'month', label: '30 dias' },
    { value: 'custom', label: 'Período Personalizado' }
];
