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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { generateTicketId } from "../client/src/lib/utils";
// In-memory storage implementation
var MemStorage = /** @class */ (function () {
    function MemStorage() {
        // Initialize maps
        this.users = new Map();
        this.customers = new Map();
        this.officials = new Map();
        this.tickets = new Map();
        this.ticketReplies = new Map();
        this.ticketStatusHistory = new Map();
        this.slaDefinitions = new Map();
        this.officialDepartments = new Map();
        // Initialize auto-increment IDs
        this.userId = 1;
        this.customerId = 1;
        this.officialId = 1;
        this.ticketId = 1;
        this.replyId = 1;
        this.historyId = 1;
        this.slaId = 1;
        this.officialDepartmentId = 1;
        // Add some initial data
        this.initializeData();
    }
    MemStorage.prototype.initializeData = function () {
        // Add a default admin user
        var adminUser = {
            id: this.userId++,
            username: 'admin',
            password: 'admin123', // In a real app, this would be hashed
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin',
            avatarUrl: null,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.users.set(adminUser.id, adminUser);
        // Add a support user
        var supportUser = {
            id: this.userId++,
            username: 'support',
            password: 'support', // In a real app, this would be hashed
            email: 'support@example.com',
            name: 'Support User',
            role: 'support',
            avatarUrl: null,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.users.set(supportUser.id, supportUser);
        // Add a customer user
        var customerUser = {
            id: this.userId++,
            username: 'customer',
            password: 'customer', // In a real app, this would be hashed
            email: 'customer@example.com',
            name: 'John Snow',
            role: 'customer',
            avatarUrl: null,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        // Add a inactive user for testing
        var inactiveUser = {
            id: this.userId++,
            username: 'inactive',
            password: 'inactive',
            email: 'inactive@example.com',
            name: 'Inactive User',
            role: 'customer',
            avatarUrl: null,
            active: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.users.set(customerUser.id, customerUser);
        this.users.set(inactiveUser.id, inactiveUser);
        // Add a customer record
        var customer = {
            id: this.customerId++,
            name: 'John Snow',
            email: 'customer@example.com',
            phone: '123-456-7890',
            company: 'ABC Corp',
            userId: customerUser.id,
            avatarUrl: 'https://randomuser.me/api/portraits/men/85.jpg',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.customers.set(customer.id, customer);
        // Add an official record
        var official = {
            id: this.officialId++,
            name: 'Support User',
            email: 'support@example.com',
            userId: supportUser.id,
            isActive: true,
            avatarUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            departments: []
        };
        this.officials.set(official.id, official);
        // Add an initial department for the official
        var initialDept = {
            id: this.officialDepartmentId++,
            officialId: official.id,
            department: 'technical',
            createdAt: new Date(),
        };
        this.officialDepartments.set(initialDept.id, initialDept);
        // Update the departments array in the official object (optional but good for consistency)
        official.departments = [initialDept];
        // Add some SLA definitions
        var slaLow = {
            id: this.slaId++,
            priority: 'low',
            responseTimeHours: 48,
            resolutionTimeHours: 96,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.slaDefinitions.set(slaLow.id, slaLow);
        var slaMedium = {
            id: this.slaId++,
            priority: 'medium',
            responseTimeHours: 24,
            resolutionTimeHours: 48,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.slaDefinitions.set(slaMedium.id, slaMedium);
        var slaHigh = {
            id: this.slaId++,
            priority: 'high',
            responseTimeHours: 8,
            resolutionTimeHours: 24,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.slaDefinitions.set(slaHigh.id, slaHigh);
        var slaCritical = {
            id: this.slaId++,
            priority: 'critical',
            responseTimeHours: 4,
            resolutionTimeHours: 12,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.slaDefinitions.set(slaCritical.id, slaCritical);
        // Create sample tickets
        var ticket1 = {
            id: this.ticketId++,
            ticketId: generateTicketId("TE"),
            title: "Problema de login",
            description: "Não consigo acessar minha conta.",
            status: "ongoing",
            priority: "medium",
            type: "technical",
            customerId: customer.id,
            customerEmail: customer.email,
            assignedToId: official.id,
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
            incidentTypeId: 1,
            departmentId: 1,
            firstResponseAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            resolvedAt: null,
            slaBreached: false,
            customer: customer,
            official: official,
            replies: []
        };
        this.tickets.set(ticket1.id, ticket1);
        var ticket2 = {
            id: this.ticketId++,
            ticketId: generateTicketId("GE"),
            title: "Dúvida sobre fatura",
            description: "Preciso entender minha última fatura.",
            status: "new",
            priority: "low",
            type: "billing",
            customerId: customer.id,
            customerEmail: customer.email,
            assignedToId: null,
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            incidentTypeId: null,
            departmentId: 2,
            firstResponseAt: null,
            resolvedAt: null,
            slaBreached: false,
            customer: customer,
            official: undefined,
            replies: []
        };
        this.tickets.set(ticket2.id, ticket2);
        var ticket3 = {
            id: this.ticketId++,
            ticketId: generateTicketId("SA"),
            title: "Solicitação de demonstração",
            description: "Gostaria de agendar uma demonstração.",
            status: "resolved",
            priority: "high",
            type: "sales",
            customerId: customer.id,
            customerEmail: customer.email,
            assignedToId: official.id,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            incidentTypeId: null,
            departmentId: 3,
            firstResponseAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            slaBreached: false,
            customer: customer,
            official: official,
            replies: []
        };
        this.tickets.set(ticket3.id, ticket3);
        // Add some ticket replies
        var reply1 = {
            id: this.replyId++,
            ticketId: ticket1.id,
            userId: official.userId,
            message: "Olá! Estamos verificando seu problema de login.",
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            isInternal: false,
            user: supportUser
        };
        this.ticketReplies.set(reply1.id, reply1);
    };
    // User operations
    MemStorage.prototype.getUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.users.get(id)];
            });
        });
    };
    MemStorage.prototype.getUserByUsername = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.users.values()).find(function (user) { return user.username === username; })];
            });
        });
    };
    MemStorage.prototype.getUserByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.users.values()).find(function (user) { return user.email === email; })];
            });
        });
    };
    MemStorage.prototype.createUser = function (userData) {
        return __awaiter(this, void 0, void 0, function () {
            var newId, _a, createdAt, updatedAt, restUserData, user;
            return __generator(this, function (_b) {
                newId = this.userId++;
                _a = userData, createdAt = _a.createdAt, updatedAt = _a.updatedAt, restUserData = __rest(_a, ["createdAt", "updatedAt"]);
                user = __assign(__assign({ id: newId }, restUserData), { password: userData.password, createdAt: new Date(), updatedAt: new Date() });
                this.users.set(newId, user);
                return [2 /*return*/, user];
            });
        });
    };
    MemStorage.prototype.updateUser = function (id, userData) {
        return __awaiter(this, void 0, void 0, function () {
            var user, updatedUser;
            return __generator(this, function (_a) {
                user = this.users.get(id);
                if (!user)
                    return [2 /*return*/, undefined];
                updatedUser = __assign(__assign(__assign({}, user), userData), { updatedAt: new Date() });
                this.users.set(id, updatedUser);
                return [2 /*return*/, updatedUser];
            });
        });
    };
    MemStorage.prototype.deleteUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.users.delete(id)];
            });
        });
    };
    MemStorage.prototype.inactivateUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var user, updatedUser;
            return __generator(this, function (_a) {
                user = this.users.get(id);
                if (!user)
                    return [2 /*return*/, undefined];
                updatedUser = __assign(__assign({}, user), { active: false, updatedAt: new Date() });
                this.users.set(id, updatedUser);
                return [2 /*return*/, updatedUser];
            });
        });
    };
    MemStorage.prototype.activateUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var user, updatedUser;
            return __generator(this, function (_a) {
                user = this.users.get(id);
                if (!user)
                    return [2 /*return*/, undefined];
                updatedUser = __assign(__assign({}, user), { active: true, updatedAt: new Date() });
                this.users.set(id, updatedUser);
                return [2 /*return*/, updatedUser];
            });
        });
    };
    MemStorage.prototype.getActiveUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.users.values()).filter(function (user) { return user.active !== false; })];
            });
        });
    };
    MemStorage.prototype.getAllUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.users.values())];
            });
        });
    };
    // Customer operations
    MemStorage.prototype.getCustomers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.customers.values())];
            });
        });
    };
    MemStorage.prototype.getCustomer = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.customers.get(id)];
            });
        });
    };
    MemStorage.prototype.getCustomerByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.customers.values()).find(function (customer) { return customer.email === email; })];
            });
        });
    };
    MemStorage.prototype.createCustomer = function (customerData) {
        return __awaiter(this, void 0, void 0, function () {
            var newId, _a, createdAt, updatedAt, restCustomerData, customer;
            return __generator(this, function (_b) {
                newId = this.customerId++;
                _a = customerData, createdAt = _a.createdAt, updatedAt = _a.updatedAt, restCustomerData = __rest(_a, ["createdAt", "updatedAt"]);
                customer = __assign(__assign({ id: newId }, restCustomerData), { createdAt: new Date(), updatedAt: new Date() });
                this.customers.set(newId, customer);
                return [2 /*return*/, customer];
            });
        });
    };
    MemStorage.prototype.updateCustomer = function (id, customerData) {
        return __awaiter(this, void 0, void 0, function () {
            var customer, updatedCustomer;
            return __generator(this, function (_a) {
                customer = this.customers.get(id);
                if (!customer)
                    return [2 /*return*/, undefined];
                updatedCustomer = __assign(__assign(__assign({}, customer), customerData), { updatedAt: new Date() });
                this.customers.set(id, updatedCustomer);
                return [2 /*return*/, updatedCustomer];
            });
        });
    };
    MemStorage.prototype.deleteCustomer = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.customers.delete(id)];
            });
        });
    };
    // Official operations
    MemStorage.prototype.getOfficials = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.officials.values())];
            });
        });
    };
    MemStorage.prototype.getOfficial = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.officials.get(id)];
            });
        });
    };
    MemStorage.prototype.getOfficialByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.officials.values()).find(function (official) { return official.email === email; })];
            });
        });
    };
    MemStorage.prototype.createOfficial = function (officialData) {
        return __awaiter(this, void 0, void 0, function () {
            var newId, _a, inputDepartments, createdAt, updatedAt, restOfficialData, official, _i, inputDepartments_1, dept, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        newId = this.officialId++;
                        _a = officialData, inputDepartments = _a.departments, createdAt = _a.createdAt, updatedAt = _a.updatedAt, restOfficialData = __rest(_a, ["departments", "createdAt", "updatedAt"]);
                        official = __assign(__assign({ id: newId }, restOfficialData), { departments: [], createdAt: new Date(), updatedAt: new Date() });
                        this.officials.set(newId, official);
                        if (!(inputDepartments && Array.isArray(inputDepartments))) return [3 /*break*/, 6];
                        _i = 0, inputDepartments_1 = inputDepartments;
                        _c.label = 1;
                    case 1:
                        if (!(_i < inputDepartments_1.length)) return [3 /*break*/, 4];
                        dept = inputDepartments_1[_i];
                        return [4 /*yield*/, this.addOfficialDepartment({ officialId: newId, department: dept })];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        _b = official;
                        return [4 /*yield*/, this.getOfficialDepartments(newId)];
                    case 5:
                        _b.departments = _c.sent();
                        _c.label = 6;
                    case 6: return [2 /*return*/, official];
                }
            });
        });
    };
    MemStorage.prototype.updateOfficial = function (id, officialData) {
        return __awaiter(this, void 0, void 0, function () {
            var official, updatedOfficial;
            return __generator(this, function (_a) {
                official = this.officials.get(id);
                if (!official)
                    return [2 /*return*/, undefined];
                updatedOfficial = __assign(__assign(__assign({}, official), officialData), { updatedAt: new Date() });
                this.officials.set(id, updatedOfficial);
                return [2 /*return*/, updatedOfficial];
            });
        });
    };
    MemStorage.prototype.deleteOfficial = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.officials.delete(id)];
            });
        });
    };
    // Ticket operations
    MemStorage.prototype.getTickets = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.tickets.values())];
            });
        });
    };
    MemStorage.prototype.getTicket = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var ticket, replies;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ticket = this.tickets.get(id);
                        if (!ticket)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, this.getTicketReplies(id)];
                    case 1:
                        replies = _a.sent();
                        return [2 /*return*/, __assign(__assign({}, ticket), { replies: replies })];
                }
            });
        });
    };
    MemStorage.prototype.getTicketByTicketId = function (ticketId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.tickets.values()).find(function (ticket) { return ticket.ticketId === ticketId; })];
            });
        });
    };
    MemStorage.prototype.getTicketsByStatus = function (status) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.tickets.values()).filter(function (ticket) { return ticket.status === status; })];
            });
        });
    };
    MemStorage.prototype.getTicketsByCustomerId = function (customerId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.tickets.values()).filter(function (ticket) { return ticket.customerId === customerId; })];
            });
        });
    };
    MemStorage.prototype.getTicketsByOfficialId = function (officialId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.tickets.values()).filter(function (ticket) { return ticket.assignedToId === officialId; })];
            });
        });
    };
    MemStorage.prototype.createTicket = function (ticketData) {
        return __awaiter(this, void 0, void 0, function () {
            var newId, now, ticketCustomer, ticket;
            var _a;
            return __generator(this, function (_b) {
                newId = this.ticketId++;
                now = new Date();
                ticketCustomer = Array.from(this.customers.values()).find(function (c) { return c.email === ticketData.customerEmail; });
                ticket = {
                    id: newId,
                    ticketId: generateTicketId(((_a = ticketData.type) === null || _a === void 0 ? void 0 : _a.substring(0, 2).toUpperCase()) || "GE"),
                    title: ticketData.title,
                    description: ticketData.description,
                    customerEmail: ticketData.customerEmail,
                    type: ticketData.type,
                    priority: ticketData.priority || 'medium',
                    departmentId: ticketData.departmentId || null,
                    incidentTypeId: ticketData.incidentTypeId || null,
                    status: 'new',
                    createdAt: now,
                    updatedAt: now,
                    assignedToId: null,
                    customerId: (ticketCustomer === null || ticketCustomer === void 0 ? void 0 : ticketCustomer.id) || null,
                    firstResponseAt: null,
                    resolvedAt: null,
                    slaBreached: false,
                    customer: ticketCustomer || { id: 0, name: 'Desconhecido', email: ticketData.customerEmail, createdAt: now, updatedAt: now, avatarUrl: null, company: null, phone: null, userId: null },
                    official: undefined,
                    replies: []
                };
                this.tickets.set(newId, ticket);
                return [2 /*return*/, ticket];
            });
        });
    };
    MemStorage.prototype.updateTicket = function (id, ticketData) {
        return __awaiter(this, void 0, void 0, function () {
            var ticket, now, updatedTicket;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ticket = this.tickets.get(id);
                        if (!ticket)
                            return [2 /*return*/, undefined];
                        now = new Date();
                        updatedTicket = __assign(__assign(__assign({}, ticket), ticketData), { updatedAt: now });
                        // If status changed to resolved, set resolvedAt
                        if (ticketData.status === 'resolved' && ticket.status !== 'resolved') {
                            updatedTicket.resolvedAt = now;
                        }
                        this.tickets.set(id, updatedTicket);
                        if (!(ticketData.status && ticketData.status !== ticket.status)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.addTicketStatusHistory(id, ticket.status, ticketData.status)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/, updatedTicket];
                }
            });
        });
    };
    MemStorage.prototype.deleteTicket = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.tickets.delete(id)];
            });
        });
    };
    // Ticket reply operations
    MemStorage.prototype.getTicketReplies = function (ticketId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.ticketReplies.values())
                        .filter(function (reply) { return reply.ticketId === ticketId; })
                        .sort(function (a, b) { return a.createdAt.getTime() - b.createdAt.getTime(); })];
            });
        });
    };
    MemStorage.prototype.createTicketReply = function (replyData) {
        return __awaiter(this, void 0, void 0, function () {
            var newId, now, reply, ticket;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        newId = this.replyId++;
                        now = new Date();
                        reply = {
                            id: newId,
                            ticketId: replyData.ticketId,
                            message: replyData.message,
                            status: replyData.status,
                            isInternal: (_a = replyData.isInternal) !== null && _a !== void 0 ? _a : false,
                            assignedToId: replyData.assignedToId,
                            userId: 1,
                            createdAt: now,
                            user: this.users.get(1) || undefined
                        };
                        this.ticketReplies.set(newId, reply);
                        if (!replyData.status) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.updateTicket(replyData.ticketId, {
                                status: replyData.status,
                                type: replyData.type
                            })];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [4 /*yield*/, this.getTicket(replyData.ticketId)];
                    case 3:
                        ticket = _b.sent();
                        if (!(ticket && !ticket.firstResponseAt)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.updateTicket(replyData.ticketId, { firstResponseAt: now })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5: return [2 /*return*/, reply];
                }
            });
        });
    };
    // Helper for ticket status history
    MemStorage.prototype.addTicketStatusHistory = function (ticketId, oldStatus, newStatus, changedById) {
        return __awaiter(this, void 0, void 0, function () {
            var newId, history;
            return __generator(this, function (_a) {
                newId = this.historyId++;
                history = {
                    id: newId,
                    ticketId: ticketId,
                    oldStatus: oldStatus,
                    newStatus: newStatus,
                    changedById: changedById || null,
                    createdAt: new Date()
                };
                this.ticketStatusHistory.set(newId, history);
                return [2 /*return*/];
            });
        });
    };
    // Stats and dashboard operations
    MemStorage.prototype.getTicketStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var tickets, byStatus, byPriority;
            return __generator(this, function (_a) {
                tickets = Array.from(this.tickets.values());
                byStatus = {
                    new: 0,
                    ongoing: 0,
                    resolved: 0,
                };
                byPriority = {
                    low: 0,
                    medium: 0,
                    high: 0,
                    critical: 0,
                };
                tickets.forEach(function (ticket) {
                    byStatus[ticket.status]++;
                    byPriority[ticket.priority]++;
                });
                return [2 /*return*/, {
                        total: tickets.length,
                        byStatus: byStatus,
                        byPriority: byPriority,
                    }];
            });
        });
    };
    MemStorage.prototype.getRecentTickets = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.tickets.values())
                        .sort(function (a, b) { return b.createdAt.getTime() - a.createdAt.getTime(); })
                        .slice(0, limit)];
            });
        });
    };
    // Implementação dos métodos de departamentos de atendentes
    MemStorage.prototype.getOfficialDepartments = function (officialId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Simulação: retorna departamentos para o atendente com ID 2 (usuário de suporte)
                if (officialId === 2) {
                    return [2 /*return*/, [
                            { id: 1, officialId: 2, department: 'technical', createdAt: new Date(), updatedAt: new Date() },
                            { id: 2, officialId: 2, department: 'billing', createdAt: new Date(), updatedAt: new Date() }
                        ]];
                }
                return [2 /*return*/, []];
            });
        });
    };
    MemStorage.prototype.addOfficialDepartment = function (officialDepartment) {
        return __awaiter(this, void 0, void 0, function () {
            var newId, _a, createdAt, restData, newDept, official;
            return __generator(this, function (_b) {
                newId = this.officialDepartmentId++;
                _a = officialDepartment, createdAt = _a.createdAt, restData = __rest(_a, ["createdAt"]);
                newDept = __assign(__assign({ id: newId }, restData), { createdAt: new Date() });
                this.officialDepartments.set(newId, newDept);
                official = this.officials.get(officialDepartment.officialId);
                if (official) {
                    official.departments = __spreadArray(__spreadArray([], (official.departments || []), true), [newDept], false);
                }
                return [2 /*return*/, newDept];
            });
        });
    };
    MemStorage.prototype.removeOfficialDepartment = function (officialId, department) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Simulação: sempre retorna true (sucesso)
                return [2 /*return*/, true];
            });
        });
    };
    MemStorage.prototype.getOfficialsByDepartment = function (department) {
        return __awaiter(this, void 0, void 0, function () {
            var official;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(department === 'technical')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getOfficial(2)];
                    case 1:
                        official = _a.sent();
                        return [2 /*return*/, official ? [official] : []];
                    case 2: return [2 /*return*/, []];
                }
            });
        });
    };
    // Implementação do método para filtrar tickets por papel do usuário
    MemStorage.prototype.getTicketsByUserRole = function (userId, userRole) {
        return __awaiter(this, void 0, void 0, function () {
            var allTickets, official_1, customer_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        allTickets = Array.from(this.tickets.values());
                        if (!(userRole === 'admin')) return [3 /*break*/, 1];
                        // Administradores veem todos os tickets
                        return [2 /*return*/, allTickets];
                    case 1:
                        if (!(userRole === 'support')) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.getOfficialByEmail('support@example.com')];
                    case 2:
                        official_1 = _a.sent();
                        if (!official_1)
                            return [2 /*return*/, []];
                        // Em uma implementação completa, verificaríamos os departamentos do atendente
                        // e retornaríamos todos os tickets desses departamentos + os atribuídos a ele
                        return [2 /*return*/, allTickets.filter(function (ticket) {
                                return ticket.assignedToId === official_1.id || // Atribuídos diretamente ao atendente
                                    !ticket.assignedToId;
                            } // Ou não atribuídos a ninguém (para o atendente pegar)
                            )];
                    case 3:
                        if (!(userRole === 'customer')) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.getCustomerByEmail('customer@example.com')];
                    case 4:
                        customer_1 = _a.sent();
                        if (!customer_1)
                            return [2 /*return*/, []];
                        return [2 /*return*/, allTickets.filter(function (ticket) { return ticket.customerId === customer_1.id; })];
                    case 5: 
                    // Se não for nenhum papel conhecido, retorna array vazio
                    return [2 /*return*/, []];
                }
            });
        });
    };
    return MemStorage;
}());
export { MemStorage };
import { DatabaseStorage } from "./database-storage";
// Escolha entre MemStorage (para desenvolvimento) ou DatabaseStorage (para produção)
// export const storage = new MemStorage();
export var storage = new DatabaseStorage();
