var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
import { users, customers, officials, officialDepartments, tickets, ticketReplies, ticketStatusHistory, ticketStatusEnum, ticketPriorityEnum } from "@shared/schema";
import * as schema from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, inArray, getTableColumns } from "drizzle-orm";
var DatabaseStorage = /** @class */ (function () {
    function DatabaseStorage() {
    }
    // User operations
    DatabaseStorage.prototype.getUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.select().from(users).where(eq(users.id, id))];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getUserByUsername = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.select().from(users).where(eq(users.username, username))];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getUserByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.select().from(users).where(eq(users.email, email))];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.createUser = function (userData) {
        return __awaiter(this, void 0, void 0, function () {
            var dataWithDefaults, user, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        console.log('DatabaseStorage.createUser - Iniciando criação com dados:', JSON.stringify(userData, null, 2));
                        // Verificar campos obrigatórios
                        if (!userData.username) {
                            throw new Error('Nome de usuário é obrigatório');
                        }
                        if (!userData.email) {
                            throw new Error('Email do usuário é obrigatório');
                        }
                        if (!userData.name) {
                            throw new Error('Nome do usuário é obrigatório');
                        }
                        if (!userData.password) {
                            throw new Error('Senha do usuário é obrigatória');
                        }
                        if (!userData.role) {
                            throw new Error('Papel do usuário é obrigatório');
                        }
                        dataWithDefaults = __assign(__assign({}, userData), { active: userData.active !== false, avatarUrl: userData.avatarUrl || null });
                        console.log('DatabaseStorage.createUser - Inserindo no banco com dados tratados:', JSON.stringify(dataWithDefaults, null, 2));
                        return [4 /*yield*/, db.insert(users).values(dataWithDefaults).returning()];
                    case 1:
                        user = (_a.sent())[0];
                        if (!user) {
                            throw new Error('Falha ao criar usuário - nenhum registro retornado');
                        }
                        console.log('DatabaseStorage.createUser - Usuário criado com sucesso:', JSON.stringify(user, null, 2));
                        return [2 /*return*/, user];
                    case 2:
                        error_1 = _a.sent();
                        console.error('DatabaseStorage.createUser - Erro:', error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateUser = function (id, userData) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .update(users)
                            .set(userData)
                            .where(eq(users.id, id))
                            .returning()];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.delete(users).where(eq(users.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    DatabaseStorage.prototype.inactivateUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .update(users)
                            .set({ active: false, updatedAt: new Date() })
                            .where(eq(users.id, id))
                            .returning()];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.activateUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .update(users)
                            .set({ active: true, updatedAt: new Date() })
                            .where(eq(users.id, id))
                            .returning()];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getActiveUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db.select().from(users).where(eq(users.active, true))];
            });
        });
    };
    DatabaseStorage.prototype.getAllUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db.select().from(users)];
            });
        });
    };
    // Customer operations
    DatabaseStorage.prototype.getCustomers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db.select().from(customers)];
            });
        });
    };
    DatabaseStorage.prototype.getCustomer = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var customer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.select().from(customers).where(eq(customers.id, id))];
                    case 1:
                        customer = (_a.sent())[0];
                        return [2 /*return*/, customer || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getCustomerByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var customer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.select().from(customers).where(eq(customers.email, email))];
                    case 1:
                        customer = (_a.sent())[0];
                        return [2 /*return*/, customer || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.createCustomer = function (customerData) {
        return __awaiter(this, void 0, void 0, function () {
            var customer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.insert(customers).values(customerData).returning()];
                    case 1:
                        customer = (_a.sent())[0];
                        return [2 /*return*/, customer];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateCustomer = function (id, customerData) {
        return __awaiter(this, void 0, void 0, function () {
            var customer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .update(customers)
                            .set(customerData)
                            .where(eq(customers.id, id))
                            .returning()];
                    case 1:
                        customer = (_a.sent())[0];
                        return [2 /*return*/, customer || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteCustomer = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.delete(customers).where(eq(customers.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    // Official operations
    DatabaseStorage.prototype.getOfficials = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allOfficials, mappedOfficials, officialsWithDepartments;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .select({
                            official: officials,
                            user: users,
                        })
                            .from(officials)
                            .leftJoin(users, eq(officials.userId, users.id))];
                    case 1:
                        allOfficials = _a.sent();
                        mappedOfficials = allOfficials.map(function (_a) {
                            var official = _a.official, user = _a.user;
                            return __assign(__assign({}, official), { user: user || undefined });
                        });
                        return [4 /*yield*/, Promise.all(mappedOfficials.map(function (official) { return __awaiter(_this, void 0, void 0, function () {
                                var departmentsData;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.getOfficialDepartments(official.id)];
                                        case 1:
                                            departmentsData = _a.sent();
                                            return [2 /*return*/, __assign(__assign({}, official), { departments: departmentsData })];
                                    }
                                });
                            }); }))];
                    case 2:
                        officialsWithDepartments = _a.sent();
                        return [2 /*return*/, officialsWithDepartments];
                }
            });
        });
    };
    DatabaseStorage.prototype.getOfficial = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var official;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.select().from(officials).where(eq(officials.id, id))];
                    case 1:
                        official = (_a.sent())[0];
                        return [2 /*return*/, official || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getOfficialByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var official;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.select().from(officials).where(eq(officials.email, email))];
                    case 1:
                        official = (_a.sent())[0];
                        return [2 /*return*/, official || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.createOfficial = function (officialData) {
        return __awaiter(this, void 0, void 0, function () {
            var dataWithDefaults, official, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        console.log('DatabaseStorage.createOfficial - Iniciando criação com dados:', JSON.stringify(officialData, null, 2));
                        // Verificar campos obrigatórios
                        if (!officialData.email) {
                            throw new Error('Email do atendente é obrigatório');
                        }
                        if (!officialData.name) {
                            throw new Error('Nome do atendente é obrigatório');
                        }
                        dataWithDefaults = __assign(__assign({}, officialData), { isActive: officialData.isActive !== false, avatarUrl: officialData.avatarUrl || null });
                        console.log('DatabaseStorage.createOfficial - Inserindo no banco com dados tratados:', JSON.stringify(dataWithDefaults, null, 2));
                        return [4 /*yield*/, db.insert(officials).values(dataWithDefaults).returning()];
                    case 1:
                        official = (_a.sent())[0];
                        if (!official) {
                            throw new Error('Falha ao criar atendente - nenhum registro retornado');
                        }
                        console.log('DatabaseStorage.createOfficial - Atendente criado com sucesso:', JSON.stringify(official, null, 2));
                        return [2 /*return*/, official];
                    case 2:
                        error_2 = _a.sent();
                        console.error('DatabaseStorage.createOfficial - Erro:', error_2);
                        throw error_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateOfficial = function (id, officialData) {
        return __awaiter(this, void 0, void 0, function () {
            var official;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .update(officials)
                            .set(officialData)
                            .where(eq(officials.id, id))
                            .returning()];
                    case 1:
                        official = (_a.sent())[0];
                        return [2 /*return*/, official || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteOfficial = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Primeiro removemos os departamentos relacionados
                    return [4 /*yield*/, db.delete(officialDepartments).where(eq(officialDepartments.officialId, id))];
                    case 1:
                        // Primeiro removemos os departamentos relacionados
                        _a.sent();
                        // Depois removemos o oficial
                        return [4 /*yield*/, db.delete(officials).where(eq(officials.id, id))];
                    case 2:
                        // Depois removemos o oficial
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    DatabaseStorage.prototype.inactivateOfficial = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var official;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .update(officials)
                            .set({ isActive: false, updatedAt: new Date() })
                            .where(eq(officials.id, id))
                            .returning()];
                    case 1:
                        official = (_a.sent())[0];
                        return [2 /*return*/, official || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.activateOfficial = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var official;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .update(officials)
                            .set({ isActive: true, updatedAt: new Date() })
                            .where(eq(officials.id, id))
                            .returning()];
                    case 1:
                        official = (_a.sent())[0];
                        return [2 /*return*/, official || undefined];
                }
            });
        });
    };
    // Operações de departamentos dos oficiais
    DatabaseStorage.prototype.getOfficialDepartments = function (officialId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db
                        .select()
                        .from(officialDepartments)
                        .where(eq(officialDepartments.officialId, officialId))];
            });
        });
    };
    DatabaseStorage.prototype.addOfficialDepartment = function (officialDepartment) {
        return __awaiter(this, void 0, void 0, function () {
            var department;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .insert(officialDepartments)
                            .values(officialDepartment)
                            .returning()];
                    case 1:
                        department = (_a.sent())[0];
                        return [2 /*return*/, department];
                }
            });
        });
    };
    DatabaseStorage.prototype.removeOfficialDepartment = function (officialId, department) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .delete(officialDepartments)
                            .where(and(eq(officialDepartments.officialId, officialId), eq(officialDepartments.department, department)))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    DatabaseStorage.prototype.getOfficialsByDepartment = function (department) {
        return __awaiter(this, void 0, void 0, function () {
            var departmentOfficials;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .select()
                            .from(officialDepartments)
                            .innerJoin(officials, eq(officialDepartments.officialId, officials.id))
                            .where(eq(officialDepartments.department, department))];
                    case 1:
                        departmentOfficials = _a.sent();
                        return [2 /*return*/, departmentOfficials.map(function (row) { return row.officials; })];
                }
            });
        });
    };
    // Filtrar tickets baseado no perfil do usuário
    DatabaseStorage.prototype.getTicketsByUserRole = function (userId, userRole) {
        return __awaiter(this, void 0, void 0, function () {
            var user, departmentIdMap, departmentsJson, departmentsList, e_1, customer, official, officialDepts, departmentNames, departmentIds, conditions, ticketsData, enrichedTickets, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("Buscando tickets para usu\u00E1rio ID ".concat(userId, " com papel ").concat(userRole));
                        return [4 /*yield*/, db.select().from(users).where(eq(users.id, userId))];
                    case 1:
                        user = (_a.sent())[0];
                        if (!user) {
                            console.log('Usuário não encontrado');
                            return [2 /*return*/, []];
                        }
                        departmentIdMap = {};
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, db.select({ value: schema.systemSettings.value })
                                .from(schema.systemSettings)
                                .where(eq(schema.systemSettings.key, 'departments'))
                                .then(function (res) { var _a; return ((_a = res[0]) === null || _a === void 0 ? void 0 : _a.value) || '[]'; })];
                    case 3:
                        departmentsJson = _a.sent();
                        departmentsList = JSON.parse(departmentsJson);
                        departmentIdMap = departmentsList.reduce(function (acc, dept) {
                            // Mapeia pelo nome ou pelo valor, se disponível (para flexibilidade)
                            acc[dept.name.toLowerCase()] = dept.id;
                            if (dept.value) {
                                acc[dept.value.toLowerCase()] = dept.id;
                            }
                            return acc;
                        }, {});
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _a.sent();
                        console.error("Erro ao buscar ou parsear mapeamento de departamentos:", e_1);
                        return [3 /*break*/, 5];
                    case 5:
                        if (!(userRole === 'admin')) return [3 /*break*/, 6];
                        console.log('Papel: admin - retornando todos os tickets');
                        // Administradores veem todos os tickets
                        return [2 /*return*/, this.getTickets()];
                    case 6:
                        if (!(userRole === 'customer')) return [3 /*break*/, 8];
                        console.log('Papel: customer - buscando tickets do cliente');
                        return [4 /*yield*/, db.select().from(customers).where(eq(customers.userId, userId))];
                    case 7:
                        customer = (_a.sent())[0];
                        if (!customer) {
                            console.log("N\u00E3o foi encontrado nenhum cliente para o usu\u00E1rio ID ".concat(userId));
                            return [2 /*return*/, []];
                        }
                        console.log("Cliente encontrado: ID ".concat(customer.id));
                        return [2 /*return*/, this.getTicketsByCustomerId(customer.id)];
                    case 8:
                        if (!(userRole === 'support')) return [3 /*break*/, 15];
                        console.log('Papel: support - buscando tickets do atendente');
                        return [4 /*yield*/, db.select().from(officials).where(eq(officials.userId, userId))];
                    case 9:
                        official = (_a.sent())[0];
                        if (!official) {
                            console.log("N\u00E3o foi encontrado nenhum atendente para o usu\u00E1rio ID ".concat(userId));
                            return [2 /*return*/, []];
                        }
                        console.log("Atendente encontrado: ID ".concat(official.id));
                        return [4 /*yield*/, this.getOfficialDepartments(official.id)];
                    case 10:
                        officialDepts = _a.sent();
                        console.log("Departamentos do atendente: ".concat(JSON.stringify(officialDepts.map(function (d) { return d.department; }))));
                        if (officialDepts.length === 0) {
                            console.log('Atendente sem departamentos, mostrando apenas tickets atribuídos diretamente');
                            // Se não estiver associado a nenhum departamento, mostrar apenas tickets atribuídos diretamente
                            return [2 /*return*/, this.getTicketsByOfficialId(official.id)];
                        }
                        departmentNames = officialDepts.map(function (dept) { return dept.department; });
                        departmentIds = departmentNames
                            .map(function (name) { return departmentIdMap[name.toLowerCase()]; })
                            .filter(function (id) { return id !== undefined; });
                        console.log("IDs dos departamentos do atendente: ".concat(JSON.stringify(departmentIds)));
                        if (departmentIds.length === 0 && officialDepts.length > 0) {
                            console.warn("Nenhum ID encontrado para os departamentos: ".concat(departmentNames.join(', '), ". Verifique o mapeamento."));
                            // Se nenhum ID foi encontrado, mas o oficial tem departamentos, talvez mostrar apenas os atribuídos?
                            // Ou retornar vazio? Por segurança, retornamos apenas os atribuídos.
                            return [2 /*return*/, this.getTicketsByOfficialId(official.id)];
                        }
                        _a.label = 11;
                    case 11:
                        _a.trys.push([11, 14, , 15]);
                        conditions = [];
                        if (departmentIds.length > 0) {
                            // Condição para tickets pertencentes a qualquer um dos IDs de departamento
                            conditions.push(inArray(tickets.departmentId, departmentIds));
                        }
                        // Condição para tickets atribuídos diretamente ao oficial
                        conditions.push(eq(tickets.assignedToId, official.id));
                        return [4 /*yield*/, db
                                .select()
                                .from(tickets)
                                .where(or.apply(void 0, conditions))];
                    case 12:
                        ticketsData = _a.sent();
                        console.log("Encontrados ".concat(ticketsData.length, " tickets para o atendente"));
                        return [4 /*yield*/, Promise.all(ticketsData.map(function (ticket) { return _this.getTicket(ticket.id); }))];
                    case 13:
                        enrichedTickets = _a.sent();
                        return [2 /*return*/, enrichedTickets.filter(Boolean)];
                    case 14:
                        error_3 = _a.sent();
                        console.error('Erro ao buscar tickets para atendente:', error_3);
                        return [2 /*return*/, []];
                    case 15:
                        // Se o papel do usuário não for reconhecido, retorna array vazio
                        console.log("Papel desconhecido: ".concat(userRole));
                        return [2 /*return*/, []];
                }
            });
        });
    };
    // Ticket operations
    DatabaseStorage.prototype.getTickets = function () {
        return __awaiter(this, void 0, void 0, function () {
            var ticketsData, enrichedTickets;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.select().from(tickets)];
                    case 1:
                        ticketsData = _a.sent();
                        return [4 /*yield*/, Promise.all(ticketsData.map(function (ticket) { return __awaiter(_this, void 0, void 0, function () {
                                var customerData, officialData, officialDepartmentsData, departments, replies;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            customerData = undefined;
                                            if (!ticket.customerId) return [3 /*break*/, 2];
                                            return [4 /*yield*/, db
                                                    .select()
                                                    .from(customers)
                                                    .where(eq(customers.id, ticket.customerId))];
                                        case 1:
                                            customerData = (_a.sent())[0]; // Agora seguro
                                            _a.label = 2;
                                        case 2:
                                            officialData = undefined;
                                            if (!ticket.assignedToId) return [3 /*break*/, 5];
                                            return [4 /*yield*/, db
                                                    .select()
                                                    .from(officials)
                                                    .where(eq(officials.id, ticket.assignedToId))];
                                        case 3:
                                            officialData = (_a.sent())[0]; // Agora seguro
                                            if (!officialData) return [3 /*break*/, 5];
                                            return [4 /*yield*/, db
                                                    .select()
                                                    .from(officialDepartments)
                                                    .where(eq(officialDepartments.officialId, officialData.id))];
                                        case 4:
                                            officialDepartmentsData = _a.sent();
                                            departments = officialDepartmentsData.map(function (od) { return od.department; });
                                            officialData = __assign(__assign({}, officialData), { departments: departments });
                                            _a.label = 5;
                                        case 5: return [4 /*yield*/, this.getTicketReplies(ticket.id)];
                                        case 6:
                                            replies = _a.sent();
                                            return [2 /*return*/, __assign(__assign({}, ticket), { customer: customerData || {}, official: officialData, replies: replies || [] })];
                                    }
                                });
                            }); }))];
                    case 2:
                        enrichedTickets = _a.sent();
                        // Cast explícito para Ticket[] para resolver a incompatibilidade estrutural percebida pelo TS
                        return [2 /*return*/, enrichedTickets];
                }
            });
        });
    };
    DatabaseStorage.prototype.getTicket = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result, ticket, customerData, officialData, officialDepartmentsData, departments, replies;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .select({
                            ticket: getTableColumns(tickets),
                            customer: getTableColumns(customers)
                        })
                            .from(tickets)
                            .leftJoin(customers, eq(customers.id, tickets.customerId))
                            .where(eq(tickets.id, id))];
                    case 1:
                        result = (_a.sent())[0];
                        if (!result)
                            return [2 /*return*/, undefined];
                        ticket = result.ticket;
                        customerData = result.customer;
                        officialData = undefined;
                        if (!ticket.assignedToId) return [3 /*break*/, 4];
                        return [4 /*yield*/, db
                                .select()
                                .from(officials)
                                .where(eq(officials.id, ticket.assignedToId))];
                    case 2:
                        officialData = (_a.sent())[0]; // Seguro
                        if (!officialData) return [3 /*break*/, 4];
                        return [4 /*yield*/, db
                                .select()
                                .from(officialDepartments)
                                .where(eq(officialDepartments.officialId, officialData.id))];
                    case 3:
                        officialDepartmentsData = _a.sent();
                        departments = officialDepartmentsData.map(function (od) { return od.department; });
                        officialData = __assign(__assign({}, officialData), { departments: departments });
                        _a.label = 4;
                    case 4: return [4 /*yield*/, this.getTicketReplies(ticket.id)];
                    case 5:
                        replies = _a.sent();
                        return [2 /*return*/, __assign(__assign({}, ticket), { customer: customerData || {}, official: officialData, replies: replies || [] })]; // Cast explícito para Ticket
                }
            });
        });
    };
    DatabaseStorage.prototype.getTicketByTicketId = function (ticketId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .select({
                            ticket: getTableColumns(tickets),
                            customer: getTableColumns(customers)
                        })
                            .from(tickets)
                            .leftJoin(customers, eq(customers.id, tickets.customerId))
                            .where(eq(tickets.ticketId, ticketId))];
                    case 1:
                        result = (_a.sent())[0];
                        if (!result)
                            return [2 /*return*/, undefined];
                        // Como getTicket agora lida com o enriquecimento, podemos chamá-lo
                        return [2 /*return*/, this.getTicket(result.ticket.id)]; // result.ticket.id é number
                }
            });
        });
    };
    DatabaseStorage.prototype.getTicketsByStatus = function (status) {
        return __awaiter(this, void 0, void 0, function () {
            var ticketsData, enrichedTickets;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .select()
                            .from(tickets)
                            .where(eq(tickets.status, status))];
                    case 1:
                        ticketsData = _a.sent();
                        return [4 /*yield*/, Promise.all(ticketsData.map(function (ticket) { return _this.getTicket(ticket.id); }))];
                    case 2:
                        enrichedTickets = _a.sent();
                        return [2 /*return*/, enrichedTickets.filter(Boolean)];
                }
            });
        });
    };
    DatabaseStorage.prototype.getTicketsByCustomerId = function (customerId) {
        return __awaiter(this, void 0, void 0, function () {
            var ticketsData, enrichedTickets;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .select()
                            .from(tickets)
                            .where(eq(tickets.customerId, customerId))];
                    case 1:
                        ticketsData = _a.sent();
                        return [4 /*yield*/, Promise.all(ticketsData.map(function (ticket) { return _this.getTicket(ticket.id); }))];
                    case 2:
                        enrichedTickets = _a.sent();
                        return [2 /*return*/, enrichedTickets.filter(Boolean)];
                }
            });
        });
    };
    DatabaseStorage.prototype.getTicketsByOfficialId = function (officialId) {
        return __awaiter(this, void 0, void 0, function () {
            var ticketsData, enrichedTickets;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .select()
                            .from(tickets)
                            .where(eq(tickets.assignedToId, officialId))];
                    case 1:
                        ticketsData = _a.sent();
                        return [4 /*yield*/, Promise.all(ticketsData.map(function (ticket) { return _this.getTicket(ticket.id); }))];
                    case 2:
                        enrichedTickets = _a.sent();
                        return [2 /*return*/, enrichedTickets.filter(Boolean)];
                }
            });
        });
    };
    DatabaseStorage.prototype.createTicket = function (ticketData) {
        return __awaiter(this, void 0, void 0, function () {
            var ticketId, ticketInsertData, insertedTicket, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        ticketId = "".concat(new Date().getFullYear(), "-T").concat(String(Date.now()).slice(-6));
                        ticketInsertData = __assign(__assign({}, ticketData), { ticketId: ticketId, status: ticketStatusEnum.enumValues[0], priority: ticketData.priority || ticketPriorityEnum.enumValues[1], 
                            // Garantir que departmentId e incidentTypeId são números ou null
                            departmentId: ticketData.departmentId ? Number(ticketData.departmentId) : null, incidentTypeId: ticketData.incidentTypeId ? Number(ticketData.incidentTypeId) : null });
                        return [4 /*yield*/, db.insert(tickets).values(ticketInsertData).returning()];
                    case 1:
                        insertedTicket = (_a.sent())[0];
                        return [2 /*return*/, this.getTicket(insertedTicket.id)]; // insertedTicket.id é number
                    case 2:
                        error_4 = _a.sent();
                        console.error("Error creating ticket:", error_4);
                        throw error_4;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateTicket = function (id, ticketData) {
        return __awaiter(this, void 0, void 0, function () {
            var currentTicket, ticket;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("===== INÍCIO updateTicket =====");
                        console.log("ID do ticket: ", id);
                        console.log("Dados para atualização: ", JSON.stringify(ticketData, null, 2));
                        
                        if (!ticketData.status) return [3 /*break*/, 3];
                        return [4 /*yield*/, db.select().from(tickets).where(eq(tickets.id, id))];
                    case 1:
                        currentTicket = (_a.sent())[0];
                        if (!(currentTicket && currentTicket.status !== ticketData.status)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.addTicketStatusHistory(id, currentTicket.status, ticketData.status, 
                            // Na versão atual, o usuário que fez a atualização não é salvo
                            // Seria necessário adicionar mais um campo no schema para isso
                            undefined)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        console.log("[DatabaseStorage] Attempting to update ticket ".concat(id, " with data:"), ticketData); // <<< LOG ADICIONADO
                        console.log("SQL a ser executado: ", "UPDATE tickets SET ... WHERE id = " + id);
                        return [4 /*yield*/, db
                            .update(tickets)
                            .set(__assign(__assign({}, ticketData), { updatedAt: new Date() }))
                            .where(eq(tickets.id, id))
                            .returning()];
                    case 4:
                        ticket = (_a.sent())[0];
                        console.log("[DatabaseStorage] Update result for ticket ".concat(id, ":"), ticket); // <<< LOG ADICIONADO
                        
                        if (!ticket) {
                            console.log("ERRO: Nenhum ticket retornado após a atualização");
                            return [2 /*return*/, undefined];
                        }
                        
                        console.log("Buscando ticket completo para ID: ", ticket.id);
                        return [4 /*yield*/, this.getTicket(ticket.id)];
                    case 5:
                        var fullTicket = _a.sent();
                        console.log("Ticket completo recuperado: ", fullTicket ? "Sim" : "Não");
                        console.log("assignedToId no ticket completo: ", fullTicket ? fullTicket.assignedToId : "N/A");
                        console.log("===== FIM updateTicket =====");
                        return [2 /*return*/, fullTicket];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteTicket = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Primeiro removemos as dependências (respostas e histórico)
                    return [4 /*yield*/, db.delete(ticketReplies).where(eq(ticketReplies.ticketId, id))];
                    case 1:
                        // Primeiro removemos as dependências (respostas e histórico)
                        _a.sent();
                        return [4 /*yield*/, db.delete(ticketStatusHistory).where(eq(ticketStatusHistory.ticketId, id))];
                    case 2:
                        _a.sent();
                        // Depois removemos o ticket
                        return [4 /*yield*/, db.delete(tickets).where(eq(tickets.id, id))];
                    case 3:
                        // Depois removemos o ticket
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    // Ticket reply operations
    DatabaseStorage.prototype.getTicketReplies = function (ticketId) {
        return __awaiter(this, void 0, void 0, function () {
            var replies, enrichedReplies;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db
                            .select()
                            .from(ticketReplies)
                            .where(eq(ticketReplies.ticketId, ticketId))
                            .orderBy(ticketReplies.createdAt)];
                    case 1:
                        replies = _a.sent();
                        return [4 /*yield*/, Promise.all(replies.map(function (reply) { return __awaiter(_this, void 0, void 0, function () {
                                var user;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!reply.userId) return [3 /*break*/, 2];
                                            return [4 /*yield*/, db
                                                    .select()
                                                    .from(users)
                                                    .where(eq(users.id, reply.userId))];
                                        case 1:
                                            user = (_a.sent())[0];
                                            return [2 /*return*/, __assign(__assign({}, reply), { user: user || undefined })];
                                        case 2: return [2 /*return*/, reply];
                                    }
                                });
                            }); }))];
                    case 2:
                        enrichedReplies = _a.sent();
                        return [2 /*return*/, enrichedReplies];
                }
            });
        });
    };
    DatabaseStorage.prototype.createTicketReply = function (replyData) {
        return __awaiter(this, void 0, void 0, function () {
            var reply, ticketUpdates, ticket, ticketRepliesCount, user;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, db.insert(ticketReplies).values(replyData).returning()];
                    case 1:
                        reply = (_b.sent())[0];
                        ticketUpdates = {};
                        if (!replyData.status) return [3 /*break*/, 3];
                        return [4 /*yield*/, db.select().from(tickets).where(eq(tickets.id, reply.ticketId))];
                    case 2:
                        ticket = (_b.sent())[0];
                        if (ticket && ticket.status !== replyData.status) {
                            ticketUpdates.status = replyData.status;
                            // Se o status estiver sendo alterado para 'resolved', marcamos a data de resolução
                            if (replyData.status === 'resolved') {
                                ticketUpdates.resolvedAt = new Date();
                            }
                        }
                        _b.label = 3;
                    case 3:
                        // Se estamos atribuindo o ticket a um atendente
                        if (replyData.assignedToId) {
                            ticketUpdates.assignedToId = replyData.assignedToId;
                        }
                        if (!(Object.keys(ticketUpdates).length > 0)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.updateTicket(reply.ticketId, ticketUpdates)];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5: return [4 /*yield*/, db
                            .select({ count: sql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["count(*)"], ["count(*)"]))) })
                            .from(ticketReplies)
                            .where(eq(ticketReplies.ticketId, reply.ticketId))];
                    case 6:
                        ticketRepliesCount = _b.sent();
                        if (!(((_a = ticketRepliesCount[0]) === null || _a === void 0 ? void 0 : _a.count) === 1)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.updateTicket(reply.ticketId, { firstResponseAt: reply.createdAt })];
                    case 7:
                        _b.sent();
                        _b.label = 8;
                    case 8:
                        if (!reply.userId) return [3 /*break*/, 10];
                        return [4 /*yield*/, db
                                .select()
                                .from(users)
                                .where(eq(users.id, reply.userId))];
                    case 9:
                        user = (_b.sent())[0];
                        return [2 /*return*/, __assign(__assign({}, reply), { user: user || undefined })];
                    case 10: return [2 /*return*/, reply];
                }
            });
        });
    };
    // Helper para histórico de status
    DatabaseStorage.prototype.addTicketStatusHistory = function (ticketId, oldStatus, newStatus, changedById) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.insert(ticketStatusHistory).values({
                            ticketId: ticketId,
                            oldStatus: oldStatus,
                            newStatus: newStatus,
                            changedById: changedById,
                            createdAt: new Date()
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Stats and dashboard operations
    DatabaseStorage.prototype.getTicketStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allTickets, byStatus_1, byPriority_1, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, db.select().from(tickets)];
                    case 1:
                        allTickets = _a.sent();
                        byStatus_1 = {
                            new: 0,
                            ongoing: 0,
                            resolved: 0,
                        };
                        byPriority_1 = {
                            low: 0,
                            medium: 0,
                            high: 0,
                            critical: 0,
                        };
                        allTickets.forEach(function (ticket) {
                            byStatus_1[ticket.status] += 1;
                            byPriority_1[ticket.priority] += 1;
                        });
                        return [2 /*return*/, {
                                total: allTickets.length,
                                byStatus: byStatus_1,
                                byPriority: byPriority_1,
                            }];
                    case 2:
                        error_5 = _a.sent();
                        console.error('Erro ao obter estatísticas de tickets:', error_5);
                        return [2 /*return*/, {
                                total: 0,
                                byStatus: { new: 0, ongoing: 0, resolved: 0 },
                                byPriority: { low: 0, medium: 0, high: 0, critical: 0 }
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Obter estatísticas dos tickets filtrados pelo papel do usuário
    DatabaseStorage.prototype.getTicketStatsByUserRole = function (userId, userRole) {
        return __awaiter(this, void 0, void 0, function () {
            var userTickets, byStatus_2, byPriority_2, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getTicketsByUserRole(userId, userRole)];
                    case 1:
                        userTickets = _a.sent();
                        byStatus_2 = {
                            new: 0,
                            ongoing: 0,
                            resolved: 0,
                        };
                        byPriority_2 = {
                            low: 0,
                            medium: 0,
                            high: 0,
                            critical: 0,
                        };
                        userTickets.forEach(function (ticket) {
                            byStatus_2[ticket.status] += 1;
                            byPriority_2[ticket.priority] += 1;
                        });
                        return [2 /*return*/, {
                                total: userTickets.length,
                                byStatus: byStatus_2,
                                byPriority: byPriority_2,
                            }];
                    case 2:
                        error_6 = _a.sent();
                        console.error('Erro ao obter estatísticas de tickets por papel do usuário:', error_6);
                        return [2 /*return*/, {
                                total: 0,
                                byStatus: { new: 0, ongoing: 0, resolved: 0 },
                                byPriority: { low: 0, medium: 0, high: 0, critical: 0 }
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.getRecentTickets = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var recentTickets, enrichedTickets, error_7;
            var _this = this;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, db
                                .select()
                                .from(tickets)
                                .orderBy(desc(tickets.createdAt))
                                .limit(limit)];
                    case 1:
                        recentTickets = _a.sent();
                        return [4 /*yield*/, Promise.all(recentTickets.map(function (ticket) { return _this.getTicket(ticket.id); }))];
                    case 2:
                        enrichedTickets = _a.sent();
                        return [2 /*return*/, enrichedTickets.filter(Boolean)];
                    case 3:
                        error_7 = _a.sent();
                        console.error('Erro ao obter tickets recentes:', error_7);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Obter tickets recentes filtrados pelo papel do usuário
    DatabaseStorage.prototype.getRecentTicketsByUserRole = function (userId_1, userRole_1) {
        return __awaiter(this, arguments, void 0, function (userId, userRole, limit) {
            var userTickets, error_8;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getTicketsByUserRole(userId, userRole)];
                    case 1:
                        userTickets = _a.sent();
                        // Ordenar tickets por data de criação (mais recentes primeiro) e limitar
                        return [2 /*return*/, userTickets
                                .sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); })
                                .slice(0, limit)];
                    case 2:
                        error_8 = _a.sent();
                        console.error('Erro ao obter tickets recentes por papel do usuário:', error_8);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return DatabaseStorage;
}());
export { DatabaseStorage };
var templateObject_1;
