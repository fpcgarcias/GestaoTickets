var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from 'ws';
import { storage } from "./storage";
import { z } from "zod";
import { insertTicketSchema, insertTicketReplySchema } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "./db";
import { notificationService } from "./services/notification-service";
// Função auxiliar para salvar e carregar configurações
function saveSystemSetting(key, value) {
    return __awaiter(this, void 0, void 0, function () {
        var existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db
                        .select()
                        .from(schema.systemSettings)
                        .where(eq(schema.systemSettings.key, key))];
                case 1:
                    existing = (_a.sent())[0];
                    if (!existing) return [3 /*break*/, 3];
                    return [4 /*yield*/, db
                            .update(schema.systemSettings)
                            .set({
                            value: value,
                            updatedAt: new Date()
                        })
                            .where(eq(schema.systemSettings.id, existing.id))];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, db
                        .insert(schema.systemSettings)
                        .values({
                        key: key,
                        value: value,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function getSystemSetting(key_1) {
    return __awaiter(this, arguments, void 0, function (key, defaultValue) {
        var setting;
        if (defaultValue === void 0) { defaultValue = ''; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db
                        .select()
                        .from(schema.systemSettings)
                        .where(eq(schema.systemSettings.key, key))];
                case 1:
                    setting = (_a.sent())[0];
                    return [2 /*return*/, setting ? setting.value : defaultValue];
            }
        });
    });
}
function validateRequest(schema) {
    return function (req, res, next) {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    message: "Validation error",
                    errors: error.errors,
                });
            }
            next(error);
        }
    };
}
// Middleware para verificar se o usuário está autenticado
function authRequired(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
    }
    next();
}
// Middleware para verificar se o usuário é admin
function adminRequired(req, res, next) {
    if (!req.session || !req.session.userId || req.session.userRole !== 'admin') {
        return res.status(403).json({ message: "Acesso negado" });
    }
    next();
}
export function registerRoutes(app) {
    return __awaiter(this, void 0, void 0, function () {
        var router, httpServer, wss;
        var _this = this;
        return __generator(this, function (_a) {
            router = express.Router();
            // Rotas públicas (sem autenticação) - Login, Logout, Registro
            // Estas rotas não precisam de middleware de autenticação
            // Rota para registro de novos usuários
            router.post("/register", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, username, email, password, name_1, role, existingUser, existingEmail, userRole, hashPassword, hashedPassword, user, _, userWithoutPassword, error_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 6, , 7]);
                            _a = req.body, username = _a.username, email = _a.email, password = _a.password, name_1 = _a.name, role = _a.role;
                            return [4 /*yield*/, storage.getUserByUsername(username)];
                        case 1:
                            existingUser = _b.sent();
                            if (existingUser) {
                                return [2 /*return*/, res.status(400).json({ message: "Nome de usuário já existe" })];
                            }
                            return [4 /*yield*/, storage.getUserByEmail(email)];
                        case 2:
                            existingEmail = _b.sent();
                            if (existingEmail) {
                                return [2 /*return*/, res.status(400).json({ message: "Email já está em uso" })];
                            }
                            userRole = role || 'customer';
                            return [4 /*yield*/, import('./utils/password')];
                        case 3:
                            hashPassword = (_b.sent()).hashPassword;
                            return [4 /*yield*/, hashPassword(password)];
                        case 4:
                            hashedPassword = _b.sent();
                            return [4 /*yield*/, storage.createUser({
                                    username: username,
                                    email: email,
                                    password: hashedPassword,
                                    name: name_1,
                                    role: userRole,
                                    avatarUrl: null
                                })];
                        case 5:
                            user = _b.sent();
                            // Autenticar o usuário recém-registrado
                            if (req.session) {
                                req.session.userId = user.id;
                                req.session.userRole = user.role;
                            }
                            _ = user.password, userWithoutPassword = __rest(user, ["password"]);
                            res.status(201).json(userWithoutPassword);
                            return [3 /*break*/, 7];
                        case 6:
                            error_1 = _b.sent();
                            console.error('Erro ao registrar usuário:', error_1);
                            res.status(500).json({ message: "Falha ao registrar usuário", error: String(error_1) });
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Tickets endpoints - Todas as rotas abaixo dessa linha precisam de autenticação
            router.get("/tickets", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var tickets, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, storage.getTickets()];
                        case 1:
                            tickets = _a.sent();
                            res.json(tickets);
                            return [3 /*break*/, 3];
                        case 2:
                            error_2 = _a.sent();
                            res.status(500).json({ message: "Falha ao buscar tickets" });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Stats and dashboard endpoints
            // Busca tickets com base no papel do usuário
            router.get("/tickets/user-role", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var userId, userRole, tickets, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = req.session.userId;
                            userRole = req.session.userRole;
                            if (!userId || !userRole) {
                                return [2 /*return*/, res.status(401).json({ message: "Usuário não autenticado" })];
                            }
                            return [4 /*yield*/, storage.getTicketsByUserRole(userId, userRole)];
                        case 1:
                            tickets = _a.sent();
                            res.json(tickets);
                            return [3 /*break*/, 3];
                        case 2:
                            error_3 = _a.sent();
                            console.error('Erro ao buscar tickets por papel do usuário:', error_3);
                            res.status(500).json({ message: "Falha ao buscar tickets para o usuário" });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            router.get("/tickets/stats", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var userId, userRole, stats, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = req.session.userId;
                            userRole = req.session.userRole;
                            if (!userId || !userRole) {
                                return [2 /*return*/, res.status(401).json({ message: "Usuário não autenticado" })];
                            }
                            return [4 /*yield*/, storage.getTicketStatsByUserRole(userId, userRole)];
                        case 1:
                            stats = _a.sent();
                            res.json(stats);
                            return [3 /*break*/, 3];
                        case 2:
                            error_4 = _a.sent();
                            console.error('Erro ao buscar estatísticas de tickets:', error_4);
                            res.status(500).json({ message: "Falha ao buscar estatísticas de tickets" });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            router.get("/tickets/recent", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var userId, userRole, limit, tickets, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = req.session.userId;
                            userRole = req.session.userRole;
                            if (!userId || !userRole) {
                                return [2 /*return*/, res.status(401).json({ message: "Usuário não autenticado" })];
                            }
                            limit = req.query.limit ? parseInt(req.query.limit) : 10;
                            return [4 /*yield*/, storage.getRecentTicketsByUserRole(userId, userRole, limit)];
                        case 1:
                            tickets = _a.sent();
                            res.json(tickets);
                            return [3 /*break*/, 3];
                        case 2:
                            error_5 = _a.sent();
                            console.error('Erro ao buscar tickets recentes:', error_5);
                            res.status(500).json({ message: "Falha ao buscar tickets recentes" });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Individual ticket by ID
            router.get("/tickets/:id", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, ticket, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = parseInt(req.params.id);
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(400).json({ message: "ID de ticket inválido" })];
                            }
                            return [4 /*yield*/, storage.getTicket(id)];
                        case 1:
                            ticket = _a.sent();
                            if (!ticket) {
                                return [2 /*return*/, res.status(404).json({ message: "Ticket não encontrado" })];
                            }
                            res.json(ticket);
                            return [3 /*break*/, 3];
                        case 2:
                            error_6 = _a.sent();
                            res.status(500).json({ message: "Falha ao buscar ticket" });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Ticket creation and responses
            router.post("/tickets", authRequired, validateRequest(insertTicketSchema), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var ticketData, currentYear, typePrefix, lastTicket, nextId, ticketIdString, newTicket, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            ticketData = insertTicketSchema.parse(req.body);
                            currentYear = new Date().getFullYear();
                            typePrefix = "GE";
                            if (ticketData.type) {
                                // Se tiver um tipo, usar as duas primeiras letras do tipo
                                typePrefix = ticketData.type.substring(0, 2).toUpperCase();
                            }
                            return [4 /*yield*/, db
                                    .select({ id: schema.tickets.id })
                                    .from(schema.tickets)
                                    .orderBy(desc(schema.tickets.id))
                                    .limit(1)];
                        case 1:
                            lastTicket = (_a.sent())[0];
                            nextId = lastTicket ? lastTicket.id + 1 : 1;
                            ticketIdString = "".concat(currentYear, "-").concat(typePrefix).concat(nextId.toString().padStart(3, '0'));
                            return [4 /*yield*/, db
                                    .insert(schema.tickets)
                                    .values(__assign(__assign({}, ticketData), { ticketId: ticketIdString, status: 'new', createdAt: new Date(), updatedAt: new Date() }))
                                    .returning()];
                        case 2:
                            newTicket = (_a.sent())[0];
                            // Responder com o ticket criado
                            res.status(201).json(newTicket);
                            // Enviar notificação de novo ticket
                            notificationService.sendNotificationToAll({
                                type: 'new_ticket',
                                title: 'Novo Ticket Criado',
                                message: "Novo ticket ".concat(ticketIdString, ": ").concat(ticketData.title),
                                ticketId: newTicket.id,
                                ticketCode: ticketIdString,
                                priority: ticketData.priority,
                                timestamp: new Date()
                            });
                            return [3 /*break*/, 4];
                        case 3:
                            error_7 = _a.sent();
                            if (error_7 instanceof z.ZodError) {
                                return [2 /*return*/, res.status(400).json({
                                        message: "Dados inválidos",
                                        errors: error_7.errors
                                    })];
                            }
                            console.error(error_7);
                            res.status(500).json({ message: "Erro ao criar ticket" });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            router.post("/ticket-replies", authRequired, validateRequest(insertTicketReplySchema), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var ticketId, userId, ticket, reply, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            ticketId = req.body.ticketId;
                            userId = req.body.userId;
                            return [4 /*yield*/, storage.getTicket(ticketId)];
                        case 1:
                            ticket = _a.sent();
                            if (!ticket) {
                                return [2 /*return*/, res.status(404).json({ message: "Ticket não encontrado" })];
                            }
                            return [4 /*yield*/, storage.createTicketReply(req.body)];
                        case 2:
                            reply = _a.sent();
                            if (!userId) return [3 /*break*/, 4];
                            return [4 /*yield*/, notificationService.notifyNewReply(ticketId, userId)];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            // Se for uma atualização de status ou atribuição, notificar
                            if (req.body.status !== ticket.status || req.body.assignedToId !== ticket.assignedToId) {
                                notificationService.sendNotificationToAll({
                                    type: 'ticket_updated',
                                    ticketId: ticket.id,
                                    title: "Ticket Atualizado: ".concat(ticket.title),
                                    message: "O status ou atribui\u00E7\u00E3o do ticket ".concat(ticket.ticketId, " foi atualizado."),
                                    timestamp: new Date()
                                });
                            }
                            res.status(201).json(reply);
                            return [3 /*break*/, 6];
                        case 5:
                            error_8 = _a.sent();
                            console.error('Erro ao criar resposta de ticket:', error_8);
                            res.status(500).json({ message: "Falha ao criar resposta de ticket", error: String(error_8) });
                            return [3 /*break*/, 6];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            // Customer endpoints
            router.get("/customers", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var customers, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, storage.getCustomers()];
                        case 1:
                            customers = _a.sent();
                            res.json(customers);
                            return [3 /*break*/, 3];
                        case 2:
                            error_9 = _a.sent();
                            res.status(500).json({ message: "Falha ao buscar clientes" });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            router.post("/customers", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, email, name_2, existingCustomer, existingUser, username, tempPassword, hashPassword, hashedPassword, user, customer, error_10;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 7, , 8]);
                            _a = req.body, email = _a.email, name_2 = _a.name;
                            return [4 /*yield*/, storage.getCustomerByEmail(email)];
                        case 1:
                            existingCustomer = _b.sent();
                            if (existingCustomer) {
                                return [2 /*return*/, res.status(400).json({ message: "Email já cadastrado para outro cliente" })];
                            }
                            return [4 /*yield*/, storage.getUserByEmail(email)];
                        case 2:
                            existingUser = _b.sent();
                            if (existingUser) {
                                return [2 /*return*/, res.status(400).json({ message: "Email já cadastrado para outro usuário" })];
                            }
                            username = email.split('@')[0];
                            tempPassword = Math.random().toString(36).substring(2, 8);
                            return [4 /*yield*/, import('./utils/password')];
                        case 3:
                            hashPassword = (_b.sent()).hashPassword;
                            return [4 /*yield*/, hashPassword(tempPassword)];
                        case 4:
                            hashedPassword = _b.sent();
                            return [4 /*yield*/, storage.createUser({
                                    username: username,
                                    email: email,
                                    password: hashedPassword,
                                    name: name_2,
                                    role: 'customer'
                                })];
                        case 5:
                            user = _b.sent();
                            return [4 /*yield*/, storage.createCustomer(__assign(__assign({}, req.body), { userId: user.id }))];
                        case 6:
                            customer = _b.sent();
                            // Retornar o cliente com informações de acesso
                            res.status(201).json(__assign(__assign({}, customer), { accessInfo: {
                                    username: username,
                                    temporaryPassword: tempPassword,
                                    message: "Uma senha temporária foi gerada. Por favor, informe ao cliente para alterá-la no primeiro acesso."
                                } }));
                            return [3 /*break*/, 8];
                        case 7:
                            error_10 = _b.sent();
                            console.error('Erro ao criar cliente:', error_10);
                            res.status(500).json({ message: "Falha ao criar cliente", error: String(error_10) });
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/];
                    }
                });
            }); });
            router.patch("/customers/:id", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, _a, password, customerData, customer_1, hashPassword, hashedPassword, customer, error_11;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 7, , 8]);
                            id = parseInt(req.params.id);
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(400).json({ message: "ID de cliente inválido" })];
                            }
                            _a = req.body, password = _a.password, customerData = __rest(_a, ["password"]);
                            if (!password) return [3 /*break*/, 5];
                            return [4 /*yield*/, storage.getCustomer(id)];
                        case 1:
                            customer_1 = _b.sent();
                            if (!customer_1) {
                                return [2 /*return*/, res.status(404).json({ message: "Cliente não encontrado" })];
                            }
                            if (!customer_1.userId) return [3 /*break*/, 5];
                            return [4 /*yield*/, import('./utils/password')];
                        case 2:
                            hashPassword = (_b.sent()).hashPassword;
                            return [4 /*yield*/, hashPassword(password)];
                        case 3:
                            hashedPassword = _b.sent();
                            // Atualizar a senha do usuário associado
                            return [4 /*yield*/, storage.updateUser(customer_1.userId, { password: hashedPassword })];
                        case 4:
                            // Atualizar a senha do usuário associado
                            _b.sent();
                            _b.label = 5;
                        case 5: return [4 /*yield*/, storage.updateCustomer(id, customerData)];
                        case 6:
                            customer = _b.sent();
                            if (!customer) {
                                return [2 /*return*/, res.status(404).json({ message: "Cliente não encontrado" })];
                            }
                            res.json(customer);
                            return [3 /*break*/, 8];
                        case 7:
                            error_11 = _b.sent();
                            console.error('Erro ao atualizar cliente:', error_11);
                            res.status(500).json({ message: "Falha ao atualizar cliente", error: String(error_11) });
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/];
                    }
                });
            }); });
            router.delete("/customers/:id", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, customer, userId, inactivatedUser, success, error_12;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 6, , 7]);
                            id = parseInt(req.params.id);
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(400).json({ message: "ID de cliente inválido" })];
                            }
                            return [4 /*yield*/, storage.getCustomer(id)];
                        case 1:
                            customer = _a.sent();
                            if (!customer) {
                                return [2 /*return*/, res.status(404).json({ message: "Cliente não encontrado" })];
                            }
                            userId = customer.userId;
                            if (!userId) return [3 /*break*/, 3];
                            return [4 /*yield*/, storage.inactivateUser(userId)];
                        case 2:
                            inactivatedUser = _a.sent();
                            if (!inactivatedUser) {
                                return [2 /*return*/, res.status(404).json({ message: "Usuário do cliente não encontrado" })];
                            }
                            res.json({
                                success: true,
                                message: "Cliente inativado com sucesso",
                                inactive: true
                            });
                            return [3 /*break*/, 5];
                        case 3: return [4 /*yield*/, storage.deleteCustomer(id)];
                        case 4:
                            success = _a.sent();
                            if (!success) {
                                return [2 /*return*/, res.status(404).json({ message: "Cliente não encontrado" })];
                            }
                            res.json({ success: true, message: "Cliente removido com sucesso" });
                            _a.label = 5;
                        case 5: return [3 /*break*/, 7];
                        case 6:
                            error_12 = _a.sent();
                            console.error('Erro ao excluir/inativar cliente:', error_12);
                            res.status(500).json({ message: "Falha ao excluir/inativar cliente", error: String(error_12) });
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Official endpoints
            router.get("/officials", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var officials, officialsWithDepartments, error_13;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, storage.getOfficials()];
                        case 1:
                            officials = _a.sent();
                            return [4 /*yield*/, Promise.all(officials.map(function (official) { return __awaiter(_this, void 0, void 0, function () {
                                    var officialDepartments, departments;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                // Se o atendente já tem departamentos, reutilizamos
                                                if (official.departments && Array.isArray(official.departments) && official.departments.length > 0) {
                                                    return [2 /*return*/, official];
                                                }
                                                return [4 /*yield*/, storage.getOfficialDepartments(official.id)];
                                            case 1:
                                                officialDepartments = _a.sent();
                                                departments = officialDepartments.map(function (od) { return od.department; });
                                                return [2 /*return*/, __assign(__assign({}, official), { departments: departments })];
                                        }
                                    });
                                }); }))];
                        case 2:
                            officialsWithDepartments = _a.sent();
                            res.json(officialsWithDepartments);
                            return [3 /*break*/, 4];
                        case 3:
                            error_13 = _a.sent();
                            console.error('Erro ao buscar atendentes:', error_13);
                            res.status(500).json({ message: "Falha ao buscar atendentes", error: String(error_13) });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            router.post("/officials", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, departments, officialData, user, departmentValue, dataWithDepartment, official, _i, departments_1, department, error_14;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 9, , 10]);
                            console.log("Iniciando cria\u00E7\u00E3o de atendente com dados:", JSON.stringify(req.body, null, 2));
                            _a = req.body, departments = _a.departments, officialData = __rest(_a, ["departments"]);
                            // Verificar se há departamentos selecionados
                            if (!departments || !Array.isArray(departments) || departments.length === 0) {
                                return [2 /*return*/, res.status(400).json({
                                        message: "Pelo menos um departamento deve ser selecionado para o atendente"
                                    })];
                            }
                            if (!officialData.userId) return [3 /*break*/, 2];
                            return [4 /*yield*/, storage.getUser(officialData.userId)];
                        case 1:
                            user = _b.sent();
                            if (!user) {
                                console.log("ERRO: Usu\u00E1rio com ID ".concat(officialData.userId, " n\u00E3o encontrado"));
                                return [2 /*return*/, res.status(404).json({ message: "Usuário não encontrado" })];
                            }
                            console.log("Usu\u00E1rio encontrado: ".concat(user.name, " (").concat(user.email, ")"));
                            _b.label = 2;
                        case 2:
                            departmentValue = departments[0];
                            if (typeof departmentValue === 'object' && departmentValue !== null && 'department' in departmentValue) {
                                departmentValue = departmentValue.department;
                            }
                            dataWithDepartment = __assign(__assign({}, officialData), { department: departmentValue // Adicionar campo department para compatibilidade
                             });
                            console.log("Criando atendente com dados:", JSON.stringify(dataWithDepartment, null, 2));
                            return [4 /*yield*/, storage.createOfficial(dataWithDepartment)];
                        case 3:
                            official = _b.sent();
                            console.log("Atendente criado com sucesso: ID=".concat(official.id));
                            if (!(departments && Array.isArray(departments) && departments.length > 0)) return [3 /*break*/, 8];
                            console.log("Adicionando ".concat(departments.length, " departamentos ao atendente"));
                            _i = 0, departments_1 = departments;
                            _b.label = 4;
                        case 4:
                            if (!(_i < departments_1.length)) return [3 /*break*/, 7];
                            department = departments_1[_i];
                            console.log("Adicionando departamento ".concat(department, " ao atendente ").concat(official.id));
                            return [4 /*yield*/, storage.addOfficialDepartment({
                                    officialId: official.id,
                                    department: department
                                })];
                        case 5:
                            _b.sent();
                            _b.label = 6;
                        case 6:
                            _i++;
                            return [3 /*break*/, 4];
                        case 7:
                            // Anexar departamentos ao resultado
                            official.departments = departments;
                            _b.label = 8;
                        case 8:
                            console.log("Retornando atendente criado: ID=".concat(official.id));
                            res.status(201).json(official);
                            return [3 /*break*/, 10];
                        case 9:
                            error_14 = _b.sent();
                            console.error('Erro ao criar atendente:', error_14);
                            // Se o erro ocorreu depois da criação do usuário, verificamos se temos um userId
                            // para dar uma resposta mais útil
                            if (req.body.userId) {
                                console.log("ERRO: Falha ao criar atendente para usu\u00E1rio ".concat(req.body.userId, ". ") +
                                    "Considere excluir o usu\u00E1rio para evitar inconsist\u00EAncias.");
                            }
                            res.status(500).json({
                                message: "Falha ao criar atendente",
                                error: String(error_14),
                                userId: req.body.userId || null, // Retornar o ID do usuário para possível limpeza
                                suggestion: "O usuário pode ter sido criado mas o atendente não. Considere excluir o usuário e tentar novamente."
                            });
                            return [3 /*break*/, 10];
                        case 10: return [2 /*return*/];
                    }
                });
            }); });
            router.patch("/officials/:id", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, _a, departments, password, department, user, officialData, departmentValue, updateData, official, userUpdateData, hashPassword_1, userUpdateData, hashPassword_2, hashPassword, hashedPassword, updatedOfficial, existingDepartments, _i, existingDepartments_1, dept, _b, departments_2, department_1, userData, _c, password_1, userWithoutPassword, error_15;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _d.trys.push([0, 26, , 27]);
                            id = parseInt(req.params.id);
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(400).json({ message: "ID de atendente inválido" })];
                            }
                            _a = req.body, departments = _a.departments, password = _a.password, department = _a.department, user = _a.user, officialData = __rest(_a, ["departments", "password", "department", "user"]);
                            // Verificar se temos pelo menos um departamento
                            if (!departments || !Array.isArray(departments) || departments.length === 0) {
                                if (!department) { // Se nem department foi fornecido
                                    return [2 /*return*/, res.status(400).json({ message: "Pelo menos um departamento deve ser selecionado" })];
                                }
                            }
                            departmentValue = 'technical';
                            // Se department foi fornecido diretamente, use-o
                            if (department) {
                                departmentValue = department;
                            }
                            // Caso contrário, use o primeiro departamento do array se disponível
                            else if (Array.isArray(departments) && departments.length > 0) {
                                if (typeof departments[0] === 'object' && departments[0] !== null && 'department' in departments[0]) {
                                    departmentValue = departments[0].department;
                                }
                                else {
                                    departmentValue = departments[0];
                                }
                            }
                            updateData = __assign(__assign({}, officialData), { department: departmentValue // Adicionar department para compatibilidade com a tabela física
                             });
                            return [4 /*yield*/, storage.getOfficial(id)];
                        case 1:
                            official = _d.sent();
                            if (!official) {
                                return [2 /*return*/, res.status(404).json({ message: "Atendente não encontrado" })];
                            }
                            if (!(user && official.userId)) return [3 /*break*/, 7];
                            console.log("Atualizando dados do usu\u00E1rio ".concat(official.userId, " associado ao atendente ").concat(id, ":"), user);
                            userUpdateData = {};
                            // Se o username for fornecido, atualizá-lo
                            if (user.username) {
                                userUpdateData.username = user.username;
                            }
                            // Se o email for fornecido, atualizá-lo
                            if (user.email) {
                                userUpdateData.email = user.email;
                            }
                            // Se o nome for fornecido, atualizá-lo
                            if (user.name) {
                                userUpdateData.name = user.name;
                            }
                            if (!user.password) return [3 /*break*/, 4];
                            return [4 /*yield*/, import('./utils/password')];
                        case 2:
                            hashPassword_1 = (_d.sent()).hashPassword;
                            return [4 /*yield*/, hashPassword_1(user.password)];
                        case 3:
                            userUpdateData.password = _d.sent();
                            return [3 /*break*/, 7];
                        case 4:
                            if (!password) return [3 /*break*/, 7];
                            return [4 /*yield*/, import('./utils/password')];
                        case 5:
                            hashPassword_2 = (_d.sent()).hashPassword;
                            return [4 /*yield*/, hashPassword_2(password)];
                        case 6:
                            userUpdateData.password = _d.sent();
                            _d.label = 7;
                        case 7:
                            if (!(Object.keys(userUpdateData).length > 0)) return [3 /*break*/, 9];
                            return [4 /*yield*/, storage.updateUser(official.userId, userUpdateData)];
                        case 8:
                            _d.sent();
                            _d.label = 9;
                        case 9:
                            if (!(password && official.userId && !user)) return [3 /*break*/, 13];
                            return [4 /*yield*/, import('./utils/password')];
                        case 10:
                            hashPassword = (_d.sent()).hashPassword;
                            return [4 /*yield*/, hashPassword(password)];
                        case 11:
                            hashedPassword = _d.sent();
                            // Atualizar a senha do usuário associado
                            return [4 /*yield*/, storage.updateUser(official.userId, { password: hashedPassword })];
                        case 12:
                            // Atualizar a senha do usuário associado
                            _d.sent();
                            _d.label = 13;
                        case 13: return [4 /*yield*/, storage.updateOfficial(id, updateData)];
                        case 14:
                            updatedOfficial = _d.sent();
                            if (!updatedOfficial) {
                                return [2 /*return*/, res.status(404).json({ message: "Atendente não encontrado" })];
                            }
                            if (!(departments && Array.isArray(departments))) return [3 /*break*/, 22];
                            return [4 /*yield*/, storage.getOfficialDepartments(id)];
                        case 15:
                            existingDepartments = _d.sent();
                            _i = 0, existingDepartments_1 = existingDepartments;
                            _d.label = 16;
                        case 16:
                            if (!(_i < existingDepartments_1.length)) return [3 /*break*/, 19];
                            dept = existingDepartments_1[_i];
                            return [4 /*yield*/, storage.removeOfficialDepartment(id, dept.department)];
                        case 17:
                            _d.sent();
                            _d.label = 18;
                        case 18:
                            _i++;
                            return [3 /*break*/, 16];
                        case 19:
                            _b = 0, departments_2 = departments;
                            _d.label = 20;
                        case 20:
                            if (!(_b < departments_2.length)) return [3 /*break*/, 23];
                            department_1 = departments_2[_b];
                            return [4 /*yield*/, storage.addOfficialDepartment({
                                    officialId: id,
                                    department: department_1
                                })];
                        case 21:
                            _d.sent();
                            _b++;
                            return [3 /*break*/, 20];
                        case 22:
                            // Anexar departamentos atualizados ao resultado
                            updatedOfficial.departments = departments;
                            _d.label = 23;
                        case 23:
                            if (!(updatedOfficial.userId)) return [3 /*break*/, 25];
                            return [4 /*yield*/, storage.getUser(updatedOfficial.userId)];
                        case 24:
                            userData = _d.sent();
                            if (userData) {
                                // Remover a senha do usuário antes de enviar
                                _c = userData.password, password_1 = _c === void 0 ? undefined : _c, userWithoutPassword = __rest(userData, ["password"]);
                                updatedOfficial.user = userWithoutPassword;
                            }
                            _d.label = 25;
                        case 25:
                            res.json(updatedOfficial);
                            return [3 /*break*/, 27];
                        case 26:
                            error_15 = _d.sent();
                            console.error('Erro ao atualizar atendente:', error_15);
                            res.status(500).json({ message: "Falha ao atualizar atendente", error: String(error_15) });
                            return [3 /*break*/, 27];
                        case 27: return [2 /*return*/];
                    }
                });
            }); });
            // Rota para alternar status (ativar/inativar) de um atendente
            router.patch("/officials/:id/toggle-active", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, official, userId, currentActiveStatus, updatedOfficial, error_16;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 10, , 11]);
                            id = parseInt(req.params.id);
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(400).json({ message: "ID de atendente inválido" })];
                            }
                            return [4 /*yield*/, storage.getOfficial(id)];
                        case 1:
                            official = _a.sent();
                            if (!official) {
                                return [2 /*return*/, res.status(404).json({ message: "Atendente não encontrado" })];
                            }
                            userId = official.userId;
                            currentActiveStatus = official.isActive;
                            updatedOfficial = void 0;
                            if (!currentActiveStatus) return [3 /*break*/, 5];
                            return [4 /*yield*/, storage.inactivateOfficial(id)];
                        case 2:
                            // Se está ativo, inativar
                            updatedOfficial = _a.sent();
                            if (!userId) return [3 /*break*/, 4];
                            return [4 /*yield*/, storage.inactivateUser(userId)];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            res.json({
                                success: true,
                                message: "Atendente inativado com sucesso",
                                isActive: false
                            });
                            return [3 /*break*/, 9];
                        case 5: return [4 /*yield*/, storage.activateOfficial(id)];
                        case 6:
                            // Se está inativo, ativar
                            updatedOfficial = _a.sent();
                            if (!userId) return [3 /*break*/, 8];
                            return [4 /*yield*/, storage.activateUser(userId)];
                        case 7:
                            _a.sent();
                            _a.label = 8;
                        case 8:
                            res.json({
                                success: true,
                                message: "Atendente ativado com sucesso",
                                isActive: true
                            });
                            _a.label = 9;
                        case 9: return [3 /*break*/, 11];
                        case 10:
                            error_16 = _a.sent();
                            console.error('Erro ao alternar status do atendente:', error_16);
                            res.status(500).json({ message: "Falha ao alternar status do atendente", error: String(error_16) });
                            return [3 /*break*/, 11];
                        case 11: return [2 /*return*/];
                    }
                });
            }); });
            router.delete("/officials/:id", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, official, userId, inactivatedUser, success, error_17;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 7, , 8]);
                            id = parseInt(req.params.id);
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(400).json({ message: "ID de atendente inválido" })];
                            }
                            return [4 /*yield*/, storage.getOfficial(id)];
                        case 1:
                            official = _a.sent();
                            if (!official) {
                                return [2 /*return*/, res.status(404).json({ message: "Atendente não encontrado" })];
                            }
                            userId = official.userId;
                            if (!userId) return [3 /*break*/, 4];
                            return [4 /*yield*/, storage.inactivateUser(userId)];
                        case 2:
                            inactivatedUser = _a.sent();
                            if (!inactivatedUser) {
                                return [2 /*return*/, res.status(404).json({ message: "Usuário do atendente não encontrado" })];
                            }
                            // Também inativar o atendente na tabela de atendentes para consistência
                            return [4 /*yield*/, storage.updateOfficial(id, { isActive: false })];
                        case 3:
                            // Também inativar o atendente na tabela de atendentes para consistência
                            _a.sent();
                            res.json({
                                success: true,
                                message: "Atendente inativado com sucesso",
                                inactive: true
                            });
                            return [3 /*break*/, 6];
                        case 4: return [4 /*yield*/, storage.deleteOfficial(id)];
                        case 5:
                            success = _a.sent();
                            if (!success) {
                                return [2 /*return*/, res.status(404).json({ message: "Atendente não encontrado" })];
                            }
                            res.json({ success: true, message: "Atendente removido com sucesso" });
                            _a.label = 6;
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            error_17 = _a.sent();
                            console.error('Erro ao excluir/inativar atendente:', error_17);
                            res.status(500).json({ message: "Falha ao excluir/inativar atendente", error: String(error_17) });
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/];
                    }
                });
            }); });
            // Autenticação
            router.post("/auth/login", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, username, password, user, comparePasswords, passwordMatch, _, userWithoutPassword, error_18;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 4, , 5]);
                            _a = req.body, username = _a.username, password = _a.password;
                            if (!username || !password) {
                                return [2 /*return*/, res.status(400).json({ message: "Usuário e senha são obrigatórios" })];
                            }
                            return [4 /*yield*/, storage.getUserByUsername(username)];
                        case 1:
                            user = _b.sent();
                            if (!user) {
                                return [2 /*return*/, res.status(401).json({ message: "Credenciais inválidas" })];
                            }
                            // Verificar se o usuário está ativo
                            if (user.active === false) {
                                return [2 /*return*/, res.status(401).json({ message: "Conta inativa. Contate o administrador do sistema." })];
                            }
                            return [4 /*yield*/, import('./utils/password')];
                        case 2:
                            comparePasswords = (_b.sent()).comparePasswords;
                            return [4 /*yield*/, comparePasswords(password, user.password)];
                        case 3:
                            passwordMatch = _b.sent();
                            if (!passwordMatch) {
                                return [2 /*return*/, res.status(401).json({ message: "Credenciais inválidas" })];
                            }
                            _ = user.password, userWithoutPassword = __rest(user, ["password"]);
                            // Criar ou atualizar a sessão do usuário
                            if (req.session) {
                                req.session.userId = user.id;
                                req.session.userRole = user.role;
                            }
                            res.json(userWithoutPassword);
                            return [3 /*break*/, 5];
                        case 4:
                            error_18 = _b.sent();
                            console.error('Erro de login:', error_18);
                            res.status(500).json({ message: "Erro ao processar login" });
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
            router.post("/auth/logout", function (req, res) {
                // Destruir a sessão para fazer logout
                if (req.session) {
                    req.session.destroy(function () {
                        res.json({ success: true });
                    });
                }
                else {
                    res.json({ success: true });
                }
            });
            // Endpoint para criar usuários
            router.post("/users", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, username, email, password, name_3, role, avatarUrl, existingUser, existingEmail, hashPassword, hashedPassword, user, _, userWithoutPassword, error_19;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 6, , 7]);
                            _a = req.body, username = _a.username, email = _a.email, password = _a.password, name_3 = _a.name, role = _a.role, avatarUrl = _a.avatarUrl;
                            console.log("Tentando criar usu\u00E1rio: ".concat(name_3, ", email: ").concat(email, ", username: ").concat(username, ", role: ").concat(role));
                            return [4 /*yield*/, storage.getUserByUsername(username)];
                        case 1:
                            existingUser = _b.sent();
                            if (existingUser) {
                                console.log("Erro: Nome de usu\u00E1rio '".concat(username, "' j\u00E1 existe"));
                                return [2 /*return*/, res.status(400).json({ message: "Nome de usuário já existe" })];
                            }
                            return [4 /*yield*/, storage.getUserByEmail(email)];
                        case 2:
                            existingEmail = _b.sent();
                            if (existingEmail) {
                                console.log("Erro: Email '".concat(email, "' j\u00E1 est\u00E1 em uso"));
                                return [2 /*return*/, res.status(400).json({ message: "Email já está em uso" })];
                            }
                            return [4 /*yield*/, import('./utils/password')];
                        case 3:
                            hashPassword = (_b.sent()).hashPassword;
                            return [4 /*yield*/, hashPassword(password)];
                        case 4:
                            hashedPassword = _b.sent();
                            return [4 /*yield*/, storage.createUser({
                                    username: username,
                                    email: email,
                                    password: hashedPassword,
                                    name: name_3,
                                    role: role,
                                    avatarUrl: avatarUrl,
                                    active: true // Garantir que novos usuários são criados como ativos por padrão
                                })];
                        case 5:
                            user = _b.sent();
                            _ = user.password, userWithoutPassword = __rest(user, ["password"]);
                            res.status(201).json(userWithoutPassword);
                            return [3 /*break*/, 7];
                        case 6:
                            error_19 = _b.sent();
                            console.error('Erro ao criar usuário:', error_19);
                            res.status(500).json({ message: "Falha ao criar usuário", error: String(error_19) });
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Endpoint para criar usuário de suporte e atendente em uma única transação atômica
            router.post("/support-users", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var hashPassword, createSupportUserEndpoint;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, import('./utils/password')];
                        case 1:
                            hashPassword = (_a.sent()).hashPassword;
                            return [4 /*yield*/, import('./endpoints/create-support-user')];
                        case 2:
                            createSupportUserEndpoint = (_a.sent()).createSupportUserEndpoint;
                            return [4 /*yield*/, createSupportUserEndpoint(req, res, storage, hashPassword)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            // Endpoint para atualizar informações do usuário
            router.patch("/users/:id", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, _a, name_4, email, username, password, existingUser, userWithUsername, userWithEmail, hashedPassword, hashPassword, updateData, updatedUser, _, userWithoutPassword, error_20;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 10, , 11]);
                            id = parseInt(req.params.id);
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(400).json({ message: "ID de usuário inválido" })];
                            }
                            _a = req.body, name_4 = _a.name, email = _a.email, username = _a.username, password = _a.password;
                            return [4 /*yield*/, storage.getUser(id)];
                        case 1:
                            existingUser = _b.sent();
                            if (!existingUser) {
                                return [2 /*return*/, res.status(404).json({ message: "Usuário não encontrado" })];
                            }
                            if (!(username && username !== existingUser.username)) return [3 /*break*/, 3];
                            return [4 /*yield*/, storage.getUserByUsername(username)];
                        case 2:
                            userWithUsername = _b.sent();
                            if (userWithUsername && userWithUsername.id !== id) {
                                return [2 /*return*/, res.status(400).json({ message: "Nome de usuário já está em uso" })];
                            }
                            _b.label = 3;
                        case 3:
                            if (!(email && email !== existingUser.email)) return [3 /*break*/, 5];
                            return [4 /*yield*/, storage.getUserByEmail(email)];
                        case 4:
                            userWithEmail = _b.sent();
                            if (userWithEmail && userWithEmail.id !== id) {
                                return [2 /*return*/, res.status(400).json({ message: "Email já está em uso" })];
                            }
                            _b.label = 5;
                        case 5:
                            hashedPassword = void 0;
                            if (!password) return [3 /*break*/, 8];
                            return [4 /*yield*/, import('./utils/password')];
                        case 6:
                            hashPassword = (_b.sent()).hashPassword;
                            return [4 /*yield*/, hashPassword(password)];
                        case 7:
                            hashedPassword = _b.sent();
                            _b.label = 8;
                        case 8:
                            updateData = {};
                            if (name_4)
                                updateData.name = name_4;
                            if (email)
                                updateData.email = email;
                            if (username)
                                updateData.username = username;
                            if (hashedPassword)
                                updateData.password = hashedPassword;
                            updateData.updatedAt = new Date();
                            return [4 /*yield*/, storage.updateUser(id, updateData)];
                        case 9:
                            updatedUser = _b.sent();
                            if (!updatedUser) {
                                return [2 /*return*/, res.status(500).json({ message: "Falha ao atualizar usuário" })];
                            }
                            _ = updatedUser.password, userWithoutPassword = __rest(updatedUser, ["password"]);
                            res.json(userWithoutPassword);
                            return [3 /*break*/, 11];
                        case 10:
                            error_20 = _b.sent();
                            console.error('Erro ao atualizar usuário:', error_20);
                            res.status(500).json({ message: "Falha ao atualizar usuário", error: String(error_20) });
                            return [3 /*break*/, 11];
                        case 11: return [2 /*return*/];
                    }
                });
            }); });
            // Endpoint para gerenciar status de ativação de usuários
            router.patch("/users/:id/toggle-active", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, user, updatedUser, _, userWithoutPassword, error_21;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 6, , 7]);
                            id = parseInt(req.params.id);
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(400).json({ message: "ID de usuário inválido" })];
                            }
                            return [4 /*yield*/, storage.getUser(id)];
                        case 1:
                            user = _b.sent();
                            if (!user) {
                                return [2 /*return*/, res.status(404).json({ message: "Usuário não encontrado" })];
                            }
                            // Impedir inativação da própria conta do administrador logado
                            if (user.id === ((_a = req.session) === null || _a === void 0 ? void 0 : _a.userId) && user.active !== false) {
                                return [2 /*return*/, res.status(403).json({
                                        message: "Não é possível inativar sua própria conta de administrador",
                                        type: "self-deactivation"
                                    })];
                            }
                            updatedUser = void 0;
                            if (!(user.active === false)) return [3 /*break*/, 3];
                            return [4 /*yield*/, storage.activateUser(id)];
                        case 2:
                            updatedUser = _b.sent();
                            return [3 /*break*/, 5];
                        case 3: return [4 /*yield*/, storage.inactivateUser(id)];
                        case 4:
                            updatedUser = _b.sent();
                            _b.label = 5;
                        case 5:
                            if (!updatedUser) {
                                return [2 /*return*/, res.status(500).json({ message: "Falha ao atualizar status do usuário" })];
                            }
                            _ = updatedUser.password, userWithoutPassword = __rest(updatedUser, ["password"]);
                            res.json({
                                user: userWithoutPassword,
                                message: updatedUser.active ? "Usuário ativado com sucesso" : "Usuário inativado com sucesso"
                            });
                            return [3 /*break*/, 7];
                        case 6:
                            error_21 = _b.sent();
                            console.error('Erro ao alternar status do usuário:', error_21);
                            res.status(500).json({ message: "Falha ao alternar status do usuário", error: String(error_21) });
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Endpoint para listar todos os usuários (apenas para administradores)
            router.get("/users", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var includeInactive, users, _a, usersWithoutPasswords, error_22;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 5, , 6]);
                            includeInactive = req.query.includeInactive === 'true';
                            if (!includeInactive) return [3 /*break*/, 2];
                            return [4 /*yield*/, storage.getAllUsers()];
                        case 1:
                            _a = _b.sent();
                            return [3 /*break*/, 4];
                        case 2: return [4 /*yield*/, storage.getActiveUsers()];
                        case 3:
                            _a = _b.sent();
                            _b.label = 4;
                        case 4:
                            users = _a;
                            usersWithoutPasswords = users.map(function (user) {
                                var password = user.password, userWithoutPassword = __rest(user, ["password"]);
                                return userWithoutPassword;
                            });
                            res.json(usersWithoutPasswords);
                            return [3 /*break*/, 6];
                        case 5:
                            error_22 = _b.sent();
                            console.error('Erro ao listar usuários:', error_22);
                            res.status(500).json({ message: "Falha ao listar usuários", error: String(error_22) });
                            return [3 /*break*/, 6];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            // Endpoint para obter o usuário atual (quando autenticado)
            router.get("/auth/me", authRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var user, _, userWithoutPassword, error_23;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            // Verificamos a sessão/autenticação
                            if (!req.session || !req.session.userId) {
                                return [2 /*return*/, res.status(401).json({ message: "Não autenticado" })];
                            }
                            return [4 /*yield*/, storage.getUser(req.session.userId)];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                // Se o usuário não existir mais, limpamos a sessão
                                if (req.session) {
                                    req.session.destroy(function () { });
                                }
                                return [2 /*return*/, res.status(401).json({ message: "Usuário não encontrado" })];
                            }
                            // Verificar se o usuário está ativo
                            if (user.active === false) {
                                // Se o usuário estiver inativo, invalidamos a sessão
                                if (req.session) {
                                    req.session.destroy(function () { });
                                }
                                return [2 /*return*/, res.status(401).json({ message: "Conta inativa. Contate o administrador do sistema." })];
                            }
                            _ = user.password, userWithoutPassword = __rest(user, ["password"]);
                            res.json(userWithoutPassword);
                            return [3 /*break*/, 3];
                        case 2:
                            error_23 = _a.sent();
                            console.error('Erro ao obter usuário:', error_23);
                            res.status(500).json({ message: "Erro ao obter dados do usuário" });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Rotas para configurações do sistema
            // Configurações gerais
            router.get("/settings/general", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var companyName, supportEmail, allowCustomerRegistration, error_24;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 4, , 5]);
                            return [4 /*yield*/, getSystemSetting('companyName', 'Ticket Lead')];
                        case 1:
                            companyName = _a.sent();
                            return [4 /*yield*/, getSystemSetting('supportEmail', 'suporte@ticketlead.exemplo')];
                        case 2:
                            supportEmail = _a.sent();
                            return [4 /*yield*/, getSystemSetting('allowCustomerRegistration', 'true')];
                        case 3:
                            allowCustomerRegistration = _a.sent();
                            // Montar objeto de resposta
                            res.json({
                                companyName: companyName,
                                supportEmail: supportEmail,
                                allowCustomerRegistration: allowCustomerRegistration === 'true'
                            });
                            return [3 /*break*/, 5];
                        case 4:
                            error_24 = _a.sent();
                            console.error('Erro ao obter configurações gerais:', error_24);
                            res.status(500).json({ message: "Falha ao buscar configurações gerais", error: String(error_24) });
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
            router.post("/settings/general", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, companyName, supportEmail, allowCustomerRegistration, error_25;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 4, , 5]);
                            _a = req.body, companyName = _a.companyName, supportEmail = _a.supportEmail, allowCustomerRegistration = _a.allowCustomerRegistration;
                            // Salvar configurações
                            return [4 /*yield*/, saveSystemSetting('companyName', companyName)];
                        case 1:
                            // Salvar configurações
                            _b.sent();
                            return [4 /*yield*/, saveSystemSetting('supportEmail', supportEmail)];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, saveSystemSetting('allowCustomerRegistration', allowCustomerRegistration.toString())];
                        case 3:
                            _b.sent();
                            res.json({
                                companyName: companyName,
                                supportEmail: supportEmail,
                                allowCustomerRegistration: allowCustomerRegistration
                            });
                            return [3 /*break*/, 5];
                        case 4:
                            error_25 = _b.sent();
                            console.error('Erro ao salvar configurações gerais:', error_25);
                            res.status(500).json({ message: "Falha ao salvar configurações gerais", error: String(error_25) });
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
            // Configurações de departamentos
            router.get("/settings/departments", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var departmentsJson, departments, defaultDepartments, error_26;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, getSystemSetting('departments', '[]')];
                        case 1:
                            departmentsJson = _a.sent();
                            try {
                                departments = JSON.parse(departmentsJson);
                                return [2 /*return*/, res.json(departments)];
                            }
                            catch (parseError) {
                                console.error('Erro ao fazer parse dos departamentos:', parseError);
                                defaultDepartments = [
                                    { id: 1, name: "Suporte Técnico", description: "Para problemas técnicos e de produto" },
                                    { id: 2, name: "Faturamento", description: "Para consultas de pagamento e faturamento" },
                                    { id: 3, name: "Atendimento ao Cliente", description: "Para consultas gerais e assistência" }
                                ];
                                return [2 /*return*/, res.json(defaultDepartments)];
                            }
                            return [3 /*break*/, 3];
                        case 2:
                            error_26 = _a.sent();
                            console.error('Erro ao obter departamentos:', error_26);
                            res.status(500).json({ message: "Falha ao buscar departamentos", error: String(error_26) });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            router.post("/settings/departments", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var departments, departmentsJson, error_27;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            departments = req.body;
                            if (!Array.isArray(departments)) {
                                return [2 /*return*/, res.status(400).json({ message: "Formato inválido. Envie um array de departamentos." })];
                            }
                            departmentsJson = JSON.stringify(departments);
                            return [4 /*yield*/, saveSystemSetting('departments', departmentsJson)];
                        case 1:
                            _a.sent();
                            res.json(departments);
                            return [3 /*break*/, 3];
                        case 2:
                            error_27 = _a.sent();
                            console.error('Erro ao salvar departamentos:', error_27);
                            res.status(500).json({ message: "Falha ao salvar departamentos", error: String(error_27) });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Configurações de tipos de incidentes
            router.get("/settings/incident-types", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var incidentTypes, error_28;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, db
                                    .select()
                                    .from(schema.incidentTypes)
                                    .orderBy(schema.incidentTypes.id)];
                        case 1:
                            incidentTypes = _a.sent();
                            return [2 /*return*/, res.json(incidentTypes)];
                        case 2:
                            error_28 = _a.sent();
                            console.error('Erro ao obter tipos de incidentes:', error_28);
                            res.status(500).json({ message: "Falha ao buscar tipos de incidentes", error: String(error_28) });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            router.post("/settings/incident-types", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var incidentTypes_1, legacyFormat, error_29;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            incidentTypes_1 = req.body;
                            if (!Array.isArray(incidentTypes_1)) {
                                return [2 /*return*/, res.status(400).json({ message: "Formato inválido. Envie um array de tipos de incidentes." })];
                            }
                            // Transação para atualizar tipos de incidentes
                            return [4 /*yield*/, db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var typesToInsert;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: 
                                            // 1. Excluir todos os tipos existentes
                                            return [4 /*yield*/, tx.delete(schema.incidentTypes)];
                                            case 1:
                                                // 1. Excluir todos os tipos existentes
                                                _a.sent();
                                                if (!(incidentTypes_1.length > 0)) return [3 /*break*/, 3];
                                                typesToInsert = incidentTypes_1.map(function (type) { return ({
                                                    id: type.id,
                                                    name: type.name,
                                                    value: type.value,
                                                    departmentId: type.departmentId,
                                                    createdAt: new Date(),
                                                    updatedAt: new Date()
                                                }); });
                                                return [4 /*yield*/, tx.insert(schema.incidentTypes).values(typesToInsert)];
                                            case 2:
                                                _a.sent();
                                                _a.label = 3;
                                            case 3: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 1:
                            // Transação para atualizar tipos de incidentes
                            _a.sent();
                            legacyFormat = incidentTypes_1.map(function (type) { return ({
                                id: type.id,
                                name: type.name,
                                departmentId: type.departmentId
                            }); });
                            return [4 /*yield*/, saveSystemSetting('incidentTypes', JSON.stringify(legacyFormat))];
                        case 2:
                            _a.sent();
                            res.json(incidentTypes_1);
                            return [3 /*break*/, 4];
                        case 3:
                            error_29 = _a.sent();
                            console.error('Erro ao salvar tipos de incidentes:', error_29);
                            res.status(500).json({ message: "Falha ao salvar tipos de incidentes", error: String(error_29) });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Endpoints para configurações de SLA
            router.get("/settings/sla", adminRequired, function (_req, res) { return __awaiter(_this, void 0, void 0, function () {
                var slaSettings, defaultSlaSettings, error_30;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, db.select().from(schema.slaDefinitions)];
                        case 1:
                            slaSettings = _a.sent();
                            // Se não existirem configurações, retornar valores padrão
                            if (!slaSettings || slaSettings.length === 0) {
                                defaultSlaSettings = [
                                    { id: 1, priority: 'low', responseTimeHours: 72, resolutionTimeHours: 120 },
                                    { id: 2, priority: 'medium', responseTimeHours: 48, resolutionTimeHours: 72 },
                                    { id: 3, priority: 'high', responseTimeHours: 24, resolutionTimeHours: 48 },
                                    { id: 4, priority: 'critical', responseTimeHours: 4, resolutionTimeHours: 24 },
                                ];
                                return [2 /*return*/, res.json(defaultSlaSettings)];
                            }
                            res.json(slaSettings);
                            return [3 /*break*/, 3];
                        case 2:
                            error_30 = _a.sent();
                            console.error('Erro ao obter configurações de SLA:', error_30);
                            res.status(500).json({ message: "Falha ao buscar configurações de SLA", error: String(error_30) });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            router.post("/settings/sla", adminRequired, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var slaData, priority, responseTimeHours, resolutionTimeHours, existingSla, updatedSla, newSla, error_31;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 7, , 8]);
                            slaData = req.body;
                            priority = slaData.priority, responseTimeHours = slaData.responseTimeHours, resolutionTimeHours = slaData.resolutionTimeHours;
                            if (!priority || !['low', 'medium', 'high', 'critical'].includes(priority)) {
                                return [2 /*return*/, res.status(400).json({ message: "Prioridade inválida" })];
                            }
                            return [4 /*yield*/, db
                                    .select()
                                    .from(schema.slaDefinitions)
                                    .where(eq(schema.slaDefinitions.priority, priority))];
                        case 1:
                            existingSla = (_a.sent())[0];
                            if (!existingSla) return [3 /*break*/, 4];
                            // Atualizar configuração existente
                            return [4 /*yield*/, db
                                    .update(schema.slaDefinitions)
                                    .set({
                                    responseTimeHours: responseTimeHours || existingSla.responseTimeHours,
                                    resolutionTimeHours: resolutionTimeHours || existingSla.resolutionTimeHours,
                                    updatedAt: new Date()
                                })
                                    .where(eq(schema.slaDefinitions.id, existingSla.id))];
                        case 2:
                            // Atualizar configuração existente
                            _a.sent();
                            return [4 /*yield*/, db
                                    .select()
                                    .from(schema.slaDefinitions)
                                    .where(eq(schema.slaDefinitions.id, existingSla.id))];
                        case 3:
                            updatedSla = (_a.sent())[0];
                            res.json(updatedSla);
                            return [3 /*break*/, 6];
                        case 4: return [4 /*yield*/, db
                                .insert(schema.slaDefinitions)
                                .values({
                                priority: priority,
                                responseTimeHours: responseTimeHours || 0,
                                resolutionTimeHours: resolutionTimeHours || 0,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            })
                                .returning()];
                        case 5:
                            newSla = (_a.sent())[0];
                            res.status(201).json(newSla);
                            _a.label = 6;
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            error_31 = _a.sent();
                            console.error('Erro ao salvar configurações de SLA:', error_31);
                            res.status(500).json({ message: "Falha ao salvar configurações de SLA", error: String(error_31) });
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/];
                    }
                });
            }); });
            // Montar o router em /api
            app.use("/api", router);
            httpServer = createServer(app);
            wss = new WebSocketServer({ server: httpServer, path: '/ws' });
            // Lidar com conexões WebSocket
            wss.on('connection', function (ws) {
                console.log('Nova conexão WebSocket recebida');
                // Autenticar o usuário e configurar a conexão
                ws.on('message', function (message) {
                    try {
                        var data = JSON.parse(message.toString());
                        // Processar mensagem de autenticação
                        if (data.type === 'auth') {
                            var userId = data.userId;
                            var userRole = data.userRole;
                            if (userId && userRole) {
                                // Adicionar o cliente ao serviço de notificações
                                notificationService.addClient(ws, userId, userRole);
                            }
                        }
                    }
                    catch (error) {
                        console.error('Erro ao processar mensagem WebSocket:', error);
                    }
                });
                // Lidar com fechamento da conexão
                ws.on('close', function () {
                    notificationService.removeClient(ws);
                    console.log('Conexão WebSocket fechada');
                });
            });
            return [2 /*return*/, httpServer];
        });
    });
}
