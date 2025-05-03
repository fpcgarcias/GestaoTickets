var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { WebSocket } from 'ws';
import { db } from '../db';
import { tickets, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
var NotificationService = /** @class */ (function () {
    function NotificationService() {
        this.clients = new Map();
        this.adminClients = [];
        this.supportClients = [];
        // Inicializar os ouvintes de eventos do banco de dados aqui
        this.setupEventListeners();
    }
    // Método para adicionar uma conexão WebSocket
    NotificationService.prototype.addClient = function (ws, userId, userRole) {
        ws.userId = userId;
        ws.userRole = userRole;
        // Adicionar ao grupo específico com base na função
        if (userRole === 'admin') {
            this.adminClients.push(ws);
        }
        else if (userRole === 'support') {
            this.supportClients.push(ws);
        }
        // Adicionar à lista de clientes por ID do usuário
        if (!this.clients.has(userId)) {
            this.clients.set(userId, []);
        }
        this.clients.get(userId).push(ws);
        console.log("Cliente WebSocket adicionado para usu\u00E1rio ID: ".concat(userId, ", Fun\u00E7\u00E3o: ").concat(userRole));
        console.log("Total de clientes WebSocket conectados: ".concat(this.getTotalClients()));
        // Enviar uma notificação de boas-vindas
        this.sendNotificationToUser(userId, {
            type: 'welcome',
            title: 'Bem-vindo ao TICKET LEAD',
            message: 'Você está agora conectado ao sistema de notificações.',
            timestamp: new Date()
        });
    };
    // Método para remover uma conexão WebSocket
    NotificationService.prototype.removeClient = function (ws) {
        var userId = ws.userId;
        var userRole = ws.userRole;
        if (!userId)
            return;
        // Remover dos grupos específicos
        if (userRole === 'admin') {
            this.adminClients = this.adminClients.filter(function (client) { return client !== ws; });
        }
        else if (userRole === 'support') {
            this.supportClients = this.supportClients.filter(function (client) { return client !== ws; });
        }
        // Remover da lista por ID do usuário
        if (this.clients.has(userId)) {
            var userClients = this.clients.get(userId);
            this.clients.set(userId, userClients.filter(function (client) { return client !== ws; }));
            // Se não houver mais clientes para este usuário, remover o item do mapa
            if (this.clients.get(userId).length === 0) {
                this.clients.delete(userId);
            }
        }
        console.log("Cliente WebSocket removido para usu\u00E1rio ID: ".concat(userId, ", Fun\u00E7\u00E3o: ").concat(userRole));
        console.log("Total de clientes WebSocket conectados: ".concat(this.getTotalClients()));
    };
    // Enviar notificação para um usuário específico
    NotificationService.prototype.sendNotificationToUser = function (userId, payload) {
        if (!this.clients.has(userId))
            return;
        var userClients = this.clients.get(userId);
        for (var _i = 0, userClients_1 = userClients; _i < userClients_1.length; _i++) {
            var client = userClients_1[_i];
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(payload));
            }
        }
    };
    // Enviar notificação para todos os administradores
    NotificationService.prototype.sendNotificationToAdmins = function (payload) {
        for (var _i = 0, _a = this.adminClients; _i < _a.length; _i++) {
            var client = _a[_i];
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(payload));
            }
        }
    };
    // Enviar notificação para todos os agentes de suporte
    NotificationService.prototype.sendNotificationToSupport = function (payload) {
        for (var _i = 0, _a = this.supportClients; _i < _a.length; _i++) {
            var client = _a[_i];
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(payload));
            }
        }
    };
    // Enviar notificação para todos os usuários
    NotificationService.prototype.sendNotificationToAll = function (payload) {
        // Coletar todos os clientes em um único array
        var allClients = [];
        this.clients.forEach(function (clientArray) {
            allClients.push.apply(allClients, clientArray);
        });
        // Enviar para todos os clientes abertos
        for (var _i = 0, allClients_1 = allClients; _i < allClients_1.length; _i++) {
            var client = allClients_1[_i];
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(payload));
            }
        }
    };
    // Notificar sobre a criação de um novo ticket
    NotificationService.prototype.notifyNewTicket = function (ticketId) {
        return __awaiter(this, void 0, void 0, function () {
            var ticket, payload, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, db.select().from(tickets).where(eq(tickets.id, ticketId))];
                    case 1:
                        ticket = (_a.sent())[0];
                        if (!ticket)
                            return [2 /*return*/];
                        payload = {
                            type: 'new_ticket',
                            title: 'Novo Ticket Criado',
                            message: "Um novo ticket foi criado: ".concat(ticket.title),
                            ticketId: ticket.id,
                            ticketCode: ticket.ticketId,
                            timestamp: new Date(),
                            priority: ticket.priority
                        };
                        this.sendNotificationToAdmins(payload);
                        this.sendNotificationToSupport(payload);
                        console.log("Notifica\u00E7\u00E3o enviada para novo ticket #".concat(ticket.ticketId));
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Erro ao notificar sobre novo ticket:', error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Notificar sobre uma atualização de status de ticket
    NotificationService.prototype.notifyTicketStatusUpdate = function (ticketId, oldStatus, newStatus) {
        return __awaiter(this, void 0, void 0, function () {
            var ticket, statusNames, oldStatusName, newStatusName, payload, user, adminPayload, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, db.select().from(tickets).where(eq(tickets.id, ticketId))];
                    case 1:
                        ticket = (_a.sent())[0];
                        if (!ticket)
                            return [2 /*return*/];
                        statusNames = {
                            'new': 'Novo',
                            'ongoing': 'Em Andamento',
                            'resolved': 'Resolvido'
                        };
                        oldStatusName = statusNames[oldStatus] || oldStatus;
                        newStatusName = statusNames[newStatus] || newStatus;
                        if (!ticket.customerId) return [3 /*break*/, 3];
                        payload = {
                            type: 'status_update',
                            title: 'Status do Ticket Atualizado',
                            message: "O status do seu ticket \"".concat(ticket.title, "\" foi alterado de ").concat(oldStatusName, " para ").concat(newStatusName, "."),
                            ticketId: ticket.id,
                            ticketCode: ticket.ticketId,
                            timestamp: new Date(),
                            priority: ticket.priority
                        };
                        return [4 /*yield*/, db
                                .select()
                                .from(users)
                                .where(eq(users.id, ticket.customerId))];
                    case 2:
                        user = (_a.sent())[0];
                        if (user) {
                            this.sendNotificationToUser(user.id, payload);
                        }
                        _a.label = 3;
                    case 3:
                        adminPayload = {
                            type: 'status_update',
                            title: 'Status do Ticket Atualizado',
                            message: "O status do ticket #".concat(ticket.ticketId, " \"").concat(ticket.title, "\" foi alterado de ").concat(oldStatusName, " para ").concat(newStatusName, "."),
                            ticketId: ticket.id,
                            ticketCode: ticket.ticketId,
                            timestamp: new Date(),
                            priority: ticket.priority
                        };
                        this.sendNotificationToAdmins(adminPayload);
                        this.sendNotificationToSupport(adminPayload);
                        console.log("Notifica\u00E7\u00E3o enviada para atualiza\u00E7\u00E3o de status do ticket #".concat(ticket.ticketId));
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        console.error('Erro ao notificar sobre atualização de status do ticket:', error_2);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // Notificar sobre uma nova resposta em um ticket
    NotificationService.prototype.notifyNewReply = function (ticketId, replyUserId) {
        return __awaiter(this, void 0, void 0, function () {
            var ticket, replyUser, notifyUserIds, payload, customerUser, payload, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, db.select().from(tickets).where(eq(tickets.id, ticketId))];
                    case 1:
                        ticket = (_a.sent())[0];
                        if (!ticket)
                            return [2 /*return*/];
                        return [4 /*yield*/, db.select().from(users).where(eq(users.id, replyUserId))];
                    case 2:
                        replyUser = (_a.sent())[0];
                        if (!replyUser)
                            return [2 /*return*/];
                        notifyUserIds = [];
                        if (!(replyUser.role === 'customer')) return [3 /*break*/, 3];
                        payload = {
                            type: 'new_reply',
                            title: 'Nova Resposta de Cliente',
                            message: "O cliente respondeu ao ticket #".concat(ticket.ticketId, ": \"").concat(ticket.title, "\"."),
                            ticketId: ticket.id,
                            ticketCode: ticket.ticketId,
                            timestamp: new Date(),
                            priority: ticket.priority
                        };
                        this.sendNotificationToAdmins(payload);
                        this.sendNotificationToSupport(payload);
                        return [3 /*break*/, 5];
                    case 3:
                        if (!(replyUser.role === 'admin' || replyUser.role === 'support')) return [3 /*break*/, 5];
                        if (!ticket.customerId) return [3 /*break*/, 5];
                        return [4 /*yield*/, db
                                .select()
                                .from(users)
                                .where(eq(users.id, ticket.customerId))];
                    case 4:
                        customerUser = (_a.sent())[0];
                        if (customerUser) {
                            payload = {
                                type: 'new_reply',
                                title: 'Nova Resposta no Seu Ticket',
                                message: "H\u00E1 uma nova resposta no seu ticket \"".concat(ticket.title, "\"."),
                                ticketId: ticket.id,
                                ticketCode: ticket.ticketId,
                                timestamp: new Date(),
                                priority: ticket.priority
                            };
                            this.sendNotificationToUser(customerUser.id, payload);
                        }
                        _a.label = 5;
                    case 5:
                        console.log("Notifica\u00E7\u00E3o enviada para nova resposta no ticket #".concat(ticket.ticketId));
                        return [3 /*break*/, 7];
                    case 6:
                        error_3 = _a.sent();
                        console.error('Erro ao notificar sobre nova resposta no ticket:', error_3);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // Configurar ouvintes de eventos para mudanças no banco de dados
    NotificationService.prototype.setupEventListeners = function () {
        // Nesta implementação inicial, os eventos serão acionados explicitamente pelas rotas
        // Em uma implementação mais avançada, poderíamos usar triggers de banco de dados
        // ou um sistema de eventos para acionar estas notificações automaticamente
        console.log('Serviço de notificações inicializado');
    };
    // Obter contagem total de clientes conectados
    NotificationService.prototype.getTotalClients = function () {
        var count = 0;
        this.clients.forEach(function (clientArray) {
            count += clientArray.length;
        });
        return count;
    };
    return NotificationService;
}());
// Criar uma instância singleton do serviço
export var notificationService = new NotificationService();
