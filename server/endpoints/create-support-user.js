/**
 * Endpoint para criar um usuário de suporte e o respectivo atendente em uma única transação
 * Garante a atomicidade da operação - ou cria ambos os registros ou nenhum
 */
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
import { withTransaction } from '../transaction-manager';
export function createSupportUserEndpoint(req, res, storage, hashPassword) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, username_1, email_1, password_1, name_1, _b, userDepartments_1, _c, avatarUrl_1, _d, isActive_1, existingUser, existingEmail, existingOfficial, result, user, official, departments, _, userWithoutPassword, error_1;
        var _this = this;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 5, , 6]);
                    console.log('=== Iniciando criação de usuário de suporte e atendente ===');
                    console.log('Dados recebidos:', JSON.stringify(req.body, null, 2));
                    _a = req.body, username_1 = _a.username, email_1 = _a.email, password_1 = _a.password, name_1 = _a.name, _b = _a.userDepartments, userDepartments_1 = _b === void 0 ? [] : _b, _c = _a.avatarUrl, avatarUrl_1 = _c === void 0 ? null : _c, _d = _a.isActive, isActive_1 = _d === void 0 ? true : _d;
                    // Verificar campos obrigatórios
                    if (!username_1) {
                        return [2 /*return*/, res.status(400).json({ message: "Nome de usuário é obrigatório" })];
                    }
                    if (!email_1) {
                        return [2 /*return*/, res.status(400).json({ message: "Email é obrigatório" })];
                    }
                    if (!password_1) {
                        return [2 /*return*/, res.status(400).json({ message: "Senha é obrigatória" })];
                    }
                    if (!name_1) {
                        return [2 /*return*/, res.status(400).json({ message: "Nome é obrigatório" })];
                    }
                    return [4 /*yield*/, storage.getUserByUsername(username_1)];
                case 1:
                    existingUser = _e.sent();
                    if (existingUser) {
                        console.log("Erro: Nome de usu\u00E1rio '".concat(username_1, "' j\u00E1 existe"));
                        return [2 /*return*/, res.status(400).json({ message: "Nome de usuário já existe" })];
                    }
                    return [4 /*yield*/, storage.getUserByEmail(email_1)];
                case 2:
                    existingEmail = _e.sent();
                    if (existingEmail) {
                        console.log("Erro: Email '".concat(email_1, "' j\u00E1 est\u00E1 em uso"));
                        return [2 /*return*/, res.status(400).json({ message: "Email já está em uso" })];
                    }
                    return [4 /*yield*/, storage.getOfficialByEmail(email_1)];
                case 3:
                    existingOfficial = _e.sent();
                    if (existingOfficial) {
                        console.log("Erro: J\u00E1 existe um atendente com o email '".concat(email_1, "'"));
                        return [2 /*return*/, res.status(400).json({ message: "Já existe um atendente com este email" })];
                    }
                    return [4 /*yield*/, withTransaction(function () { return __awaiter(_this, void 0, void 0, function () {
                            var hashedPassword, userData, user, defaultDepartments, defaultDepartment, departmentsArray, firstDept, deptValue, officialData, official, _i, departmentsArray_1, dept, departmentValue;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        console.log('Iniciando transação para criar usuário e atendente');
                                        return [4 /*yield*/, hashPassword(password_1)];
                                    case 1:
                                        hashedPassword = _a.sent();
                                        // 1. Criar o usuário
                                        console.log('Criando usuário com papel "support"');
                                        userData = {
                                            username: username_1,
                                            email: email_1,
                                            password: hashedPassword,
                                            name: name_1,
                                            role: 'support',
                                            avatarUrl: avatarUrl_1,
                                            active: true,
                                        };
                                        return [4 /*yield*/, storage.createUser(userData)];
                                    case 2:
                                        user = _a.sent();
                                        console.log("Usu\u00E1rio criado com ID: ".concat(user.id));
                                        // 2. Criar o atendente
                                        console.log("Criando atendente para usu\u00E1rio ID: ".concat(user.id));
                                        // Garantir que pelo menos um departamento seja fornecido
                                        if (!userDepartments_1 || !Array.isArray(userDepartments_1) || userDepartments_1.length === 0) {
                                            throw new Error('Pelo menos um departamento deve ser selecionado');
                                        }
                                        defaultDepartments = ['technical', 'general', 'billing', 'sales', 'other'];
                                        defaultDepartment = defaultDepartments[0];
                                        departmentsArray = Array.isArray(userDepartments_1) ? userDepartments_1 : [];
                                        console.log("Departamentos recebidos (original): ".concat(JSON.stringify(userDepartments_1)));
                                        console.log("Departamentos como array: ".concat(JSON.stringify(departmentsArray)));
                                        // Validar que há pelo menos um departamento
                                        if (departmentsArray.length === 0) {
                                            console.warn('Nenhum departamento foi fornecido! Usando departamento padrão:', defaultDepartment);
                                        }
                                        else {
                                            firstDept = departmentsArray[0];
                                            // Processar com base no tipo
                                            if (typeof firstDept === 'string' && firstDept.trim() !== '') {
                                                // Verificar se é um valor válido
                                                if (defaultDepartments.includes(firstDept)) {
                                                    defaultDepartment = firstDept;
                                                    console.log("Usando departamento string v\u00E1lido: ".concat(defaultDepartment));
                                                }
                                                else {
                                                    console.warn("Departamento inv\u00E1lido recebido: ".concat(firstDept, ", usando padr\u00E3o: ").concat(defaultDepartment));
                                                }
                                            }
                                            // Se for um objeto, verificar a propriedade 'department'
                                            else if (typeof firstDept === 'object' && firstDept !== null && 'department' in firstDept) {
                                                deptValue = firstDept.department;
                                                if (typeof deptValue === 'string' && deptValue.trim() !== '' && defaultDepartments.includes(deptValue)) {
                                                    defaultDepartment = deptValue;
                                                    console.log("Usando departamento de objeto v\u00E1lido: ".concat(defaultDepartment));
                                                }
                                                else {
                                                    console.warn("Departamento de objeto inv\u00E1lido: ".concat(deptValue, ", usando padr\u00E3o: ").concat(defaultDepartment));
                                                }
                                            }
                                            else {
                                                console.warn("Tipo de departamento inesperado: ".concat(typeof firstDept, ", usando padr\u00E3o: ").concat(defaultDepartment));
                                            }
                                        }
                                        console.log("Departamento final escolhido: ".concat(defaultDepartment));
                                        officialData = {
                                            name: name_1,
                                            email: email_1,
                                            userId: user.id,
                                            isActive: isActive_1,
                                            avatarUrl: avatarUrl_1,
                                            department: defaultDepartment, // Para compatibilidade com a coluna existente no banco
                                        };
                                        return [4 /*yield*/, storage.createOfficial(officialData)];
                                    case 3:
                                        official = _a.sent();
                                        console.log("Atendente criado com ID: ".concat(official.id));
                                        if (!(departmentsArray.length > 0)) return [3 /*break*/, 7];
                                        console.log("Adicionando ".concat(departmentsArray.length, " departamentos ao atendente ID: ").concat(official.id));
                                        _i = 0, departmentsArray_1 = departmentsArray;
                                        _a.label = 4;
                                    case 4:
                                        if (!(_i < departmentsArray_1.length)) return [3 /*break*/, 7];
                                        dept = departmentsArray_1[_i];
                                        departmentValue = void 0;
                                        if (typeof dept === 'object' && dept !== null && 'department' in dept) {
                                            departmentValue = dept.department;
                                        }
                                        else if (typeof dept === 'string') {
                                            departmentValue = dept;
                                        }
                                        else {
                                            console.log("Ignorando departamento de formato inv\u00E1lido: ".concat(JSON.stringify(dept)));
                                            return [3 /*break*/, 6]; // Pular este departamento
                                        }
                                        return [4 /*yield*/, storage.addOfficialDepartment({
                                                officialId: official.id,
                                                department: departmentValue,
                                            })];
                                    case 5:
                                        _a.sent();
                                        console.log("Departamento '".concat(departmentValue, "' adicionado ao atendente ID: ").concat(official.id));
                                        _a.label = 6;
                                    case 6:
                                        _i++;
                                        return [3 /*break*/, 4];
                                    case 7: return [2 /*return*/, { user: user, official: official, userDepartments: userDepartments_1 }];
                                }
                            });
                        }); })];
                case 4:
                    result = _e.sent();
                    user = result.user, official = result.official, departments = result.userDepartments;
                    _ = user.password, userWithoutPassword = __rest(user, ["password"]);
                    // Retornar o resultado completo
                    console.log('=== Criação de usuário de suporte e atendente concluída com sucesso ===');
                    res.status(201).json({
                        user: userWithoutPassword,
                        official: __assign(__assign({}, official), { departments: departments })
                    });
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _e.sent();
                    console.error('Erro ao criar usuário de suporte e atendente:', error_1);
                    res.status(500).json({
                        message: "Falha ao criar usuário e atendente",
                        error: error_1.message || String(error_1)
                    });
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
