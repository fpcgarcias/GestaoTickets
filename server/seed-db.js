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
import { db } from "./db";
import { users, tickets, customers, officials, ticketReplies, ticketStatusHistory, slaDefinitions, officialDepartments } from "@shared/schema";
function seedDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var existingUsers, adminUser, supportUser, customerUser, customer, official, slaLow, slaMedium, slaHigh, slaCritical, ticket1, ticket2, ticket3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Iniciando preenchimento do banco de dados...");
                    return [4 /*yield*/, db.select().from(users)];
                case 1:
                    existingUsers = _a.sent();
                    if (existingUsers.length > 0) {
                        console.log("O banco de dados já possui registros. Pulando o processo de seed.");
                        return [2 /*return*/];
                    }
                    // Adicionar usuários
                    console.log("Adicionando usuários...");
                    return [4 /*yield*/, db.insert(users).values({
                            username: "admin",
                            password: "admin123",
                            email: "admin@ticketlead.com",
                            name: "Administrador",
                            role: "admin",
                            avatarUrl: null,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }).returning()];
                case 2:
                    adminUser = (_a.sent())[0];
                    return [4 /*yield*/, db.insert(users).values({
                            username: "suporte",
                            password: "suporte123",
                            email: "suporte@ticketlead.com",
                            name: "Equipe de Suporte",
                            role: "support",
                            avatarUrl: null,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }).returning()];
                case 3:
                    supportUser = (_a.sent())[0];
                    return [4 /*yield*/, db.insert(users).values({
                            username: "cliente",
                            password: "cliente123",
                            email: "cliente@example.com",
                            name: "Usuário Cliente",
                            role: "customer",
                            avatarUrl: null,
                        }).returning()];
                case 4:
                    customerUser = (_a.sent())[0];
                    // Adicionar cliente
                    console.log("Adicionando clientes...");
                    return [4 /*yield*/, db.insert(customers).values({
                            name: "Empresa ABC",
                            email: "contato@empresaabc.com",
                            phone: "(11) 9999-8888",
                            company: "Empresa ABC Ltda",
                            userId: customerUser.id,
                            avatarUrl: null,
                        }).returning()];
                case 5:
                    customer = (_a.sent())[0];
                    // Adicionar atendente
                    console.log("Adicionando atendentes...");
                    return [4 /*yield*/, db.insert(officials).values({
                            name: "João Silva",
                            email: "joao.silva@ticketlead.com",
                            userId: supportUser.id,
                            isActive: true,
                            avatarUrl: null,
                        }).returning()];
                case 6:
                    official = (_a.sent())[0];
                    // Adicionar o departamento ao atendente na tabela de junção
                    return [4 /*yield*/, db.insert(officialDepartments).values({
                            officialId: official.id,
                            department: "technical"
                        })];
                case 7:
                    // Adicionar o departamento ao atendente na tabela de junção
                    _a.sent();
                    // Adicionar definições de SLA
                    console.log("Adicionando definições de SLA...");
                    return [4 /*yield*/, db.insert(slaDefinitions).values({
                            priority: "low",
                            responseTimeHours: 24,
                            resolutionTimeHours: 72,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }).returning()];
                case 8:
                    slaLow = (_a.sent())[0];
                    return [4 /*yield*/, db.insert(slaDefinitions).values({
                            priority: "medium",
                            responseTimeHours: 12,
                            resolutionTimeHours: 48,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }).returning()];
                case 9:
                    slaMedium = (_a.sent())[0];
                    return [4 /*yield*/, db.insert(slaDefinitions).values({
                            priority: "high",
                            responseTimeHours: 6,
                            resolutionTimeHours: 24,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }).returning()];
                case 10:
                    slaHigh = (_a.sent())[0];
                    return [4 /*yield*/, db.insert(slaDefinitions).values({
                            priority: "critical",
                            responseTimeHours: 2,
                            resolutionTimeHours: 12,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }).returning()];
                case 11:
                    slaCritical = (_a.sent())[0];
                    // Adicionar tickets
                    console.log("Adicionando tickets...");
                    return [4 /*yield*/, db.insert(tickets).values({
                            ticketId: "TK-2023-001",
                            title: "Problema de login no sistema",
                            description: "Não consigo acessar o sistema com minha senha atual.",
                            status: "ongoing",
                            priority: "medium",
                            type: "técnico",
                            customerId: customer.id,
                            customerEmail: customer.email,
                            assignedToId: official.id,
                            firstResponseAt: null,
                            resolvedAt: null,
                            slaBreached: null,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }).returning()];
                case 12:
                    ticket1 = (_a.sent())[0];
                    return [4 /*yield*/, db.insert(tickets).values({
                            ticketId: "TK-2023-002",
                            title: "Solicitar atualização de funcionalidade",
                            description: "Precisamos adicionar um novo botão na tela inicial.",
                            status: "new",
                            priority: "high",
                            type: "solicitação",
                            customerId: customer.id,
                            customerEmail: customer.email,
                            assignedToId: null,
                            firstResponseAt: null,
                            resolvedAt: null,
                            slaBreached: null,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }).returning()];
                case 13:
                    ticket2 = (_a.sent())[0];
                    return [4 /*yield*/, db.insert(tickets).values({
                            ticketId: "TK-2023-003",
                            title: "Dúvida sobre faturamento",
                            description: "Precisamos de informações sobre o último ciclo de faturamento.",
                            status: "resolved",
                            priority: "low",
                            type: "financeiro",
                            customerId: customer.id,
                            customerEmail: customer.email,
                            assignedToId: official.id,
                            firstResponseAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
                            resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 dia atrás
                            slaBreached: false,
                            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 dias atrás
                            updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
                        }).returning()];
                case 14:
                    ticket3 = (_a.sent())[0];
                    // Adicionar histórico de status
                    console.log("Adicionando histórico de status dos tickets...");
                    return [4 /*yield*/, db.insert(ticketStatusHistory).values({
                            ticketId: ticket1.id,
                            oldStatus: "new",
                            newStatus: "ongoing",
                            changedById: adminUser.id,
                            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
                        })];
                case 15:
                    _a.sent();
                    return [4 /*yield*/, db.insert(ticketStatusHistory).values({
                            ticketId: ticket3.id,
                            oldStatus: "new",
                            newStatus: "ongoing",
                            changedById: adminUser.id,
                            createdAt: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000) // 2.5 dias atrás
                        })];
                case 16:
                    _a.sent();
                    return [4 /*yield*/, db.insert(ticketStatusHistory).values({
                            ticketId: ticket3.id,
                            oldStatus: "ongoing",
                            newStatus: "resolved",
                            changedById: official.id,
                            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
                        })];
                case 17:
                    _a.sent();
                    // Adicionar respostas de tickets
                    console.log("Adicionando respostas aos tickets...");
                    return [4 /*yield*/, db.insert(ticketReplies).values({
                            ticketId: ticket1.id,
                            userId: official.id,
                            message: "Olá, por favor tente redefinir sua senha através do link 'Esqueci minha senha'. Se o problema persistir, nos avise.",
                            isInternal: false,
                            createdAt: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000) // 12 horas atrás
                        })];
                case 18:
                    _a.sent();
                    return [4 /*yield*/, db.insert(ticketReplies).values({
                            ticketId: ticket3.id,
                            userId: official.id,
                            message: "Enviamos por email as informações solicitadas sobre o faturamento. Por favor, confirme o recebimento.",
                            isInternal: false,
                            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 dias atrás
                        })];
                case 19:
                    _a.sent();
                    return [4 /*yield*/, db.insert(ticketReplies).values({
                            ticketId: ticket3.id,
                            userId: customerUser.id,
                            message: "Confirmando recebimento. Muito obrigado pela ajuda!",
                            isInternal: false,
                            createdAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000) // 1.5 dias atrás
                        })];
                case 20:
                    _a.sent();
                    return [4 /*yield*/, db.insert(ticketReplies).values({
                            ticketId: ticket3.id,
                            userId: official.id,
                            message: "De nada! Vou fechar este ticket como resolvido. Se precisar de mais ajuda, basta abrir um novo chamado.",
                            isInternal: false,
                            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
                        })];
                case 21:
                    _a.sent();
                    console.log("Preenchimento do banco de dados concluído com sucesso!");
                    return [2 /*return*/];
            }
        });
    });
}
// Executar o seed
seedDatabase().catch(console.error);
