/**
 * Este script localiza e corrige usuários "órfãos" que foram criados como 'support'
 * mas não têm um registro correspondente na tabela 'officials'
 */
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
import { db } from './db';
import { users, officials } from '../shared/schema';
import { eq } from 'drizzle-orm';
export function findOrphanSupportUsers() {
    return __awaiter(this, void 0, void 0, function () {
        var supportUsers, orphanUsers, _i, supportUsers_1, user, official, _a, supportUsers_2, user, official, updated, updateError_1, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Buscando usuários de suporte órfãos (sem registro de atendente)...');
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 14, , 15]);
                    return [4 /*yield*/, db
                            .select()
                            .from(users)
                            .where(eq(users.role, 'support'))];
                case 2:
                    supportUsers = _b.sent();
                    console.log("Encontrados ".concat(supportUsers.length, " usu\u00E1rios com papel 'support'"));
                    orphanUsers = [];
                    _i = 0, supportUsers_1 = supportUsers;
                    _b.label = 3;
                case 3:
                    if (!(_i < supportUsers_1.length)) return [3 /*break*/, 6];
                    user = supportUsers_1[_i];
                    return [4 /*yield*/, db
                            .select()
                            .from(officials)
                            .where(eq(officials.userId, user.id))];
                case 4:
                    official = (_b.sent())[0];
                    if (!official) {
                        console.log("Usu\u00E1rio \u00F3rf\u00E3o encontrado: ".concat(user.name, " (").concat(user.email, "), ID: ").concat(user.id));
                        orphanUsers.push(user);
                    }
                    _b.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    _a = 0, supportUsers_2 = supportUsers;
                    _b.label = 7;
                case 7:
                    if (!(_a < supportUsers_2.length)) return [3 /*break*/, 13];
                    user = supportUsers_2[_a];
                    return [4 /*yield*/, db
                            .select()
                            .from(officials)
                            .where(eq(officials.email, user.email))];
                case 8:
                    official = (_b.sent())[0];
                    if (!(official && !official.userId)) return [3 /*break*/, 12];
                    console.log("Atendente encontrado sem userId, mas com mesmo email: ".concat(user.email));
                    console.log("ID do usu\u00E1rio: ".concat(user.id, ", ID do atendente: ").concat(official.id));
                    _b.label = 9;
                case 9:
                    _b.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, db
                            .update(officials)
                            .set({ userId: user.id })
                            .where(eq(officials.id, official.id))
                            .returning()];
                case 10:
                    updated = (_b.sent())[0];
                    console.log("Atendente atualizado com userId correto: ".concat(updated.id, " -> ").concat(updated.userId));
                    return [3 /*break*/, 12];
                case 11:
                    updateError_1 = _b.sent();
                    console.error("Erro ao atualizar userId para atendente:", updateError_1);
                    return [3 /*break*/, 12];
                case 12:
                    _a++;
                    return [3 /*break*/, 7];
                case 13:
                    console.log("Total de usu\u00E1rios \u00F3rf\u00E3os encontrados: ".concat(orphanUsers.length));
                    return [2 /*return*/, orphanUsers];
                case 14:
                    error_1 = _b.sent();
                    console.error('Erro ao buscar usuários órfãos:', error_1);
                    throw error_1;
                case 15: return [2 /*return*/];
            }
        });
    });
}
export function createOfficialForUser(userId_1) {
    return __awaiter(this, arguments, void 0, function (userId, options) {
        var user, official, error_2;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, db
                            .select()
                            .from(users)
                            .where(eq(users.id, userId))];
                case 1:
                    user = (_a.sent())[0];
                    if (!user) {
                        throw new Error("Usu\u00E1rio com ID ".concat(userId, " n\u00E3o encontrado"));
                    }
                    console.log("Criando atendente para usu\u00E1rio: ".concat(user.name));
                    return [4 /*yield*/, db
                            .insert(officials)
                            .values({
                            name: options.name || user.name,
                            email: options.email || user.email,
                            userId: user.id,
                            isActive: options.isActive !== undefined ? options.isActive : user.active,
                            avatarUrl: user.avatarUrl,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        })
                            .returning()];
                case 2:
                    official = (_a.sent())[0];
                    console.log("Atendente criado com sucesso: ID=".concat(official.id));
                    return [2 /*return*/, official];
                case 3:
                    error_2 = _a.sent();
                    console.error("Erro ao criar atendente para usu\u00E1rio ".concat(userId, ":"), error_2);
                    throw error_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
export function fixAllOrphanSupportUsers() {
    return __awaiter(this, void 0, void 0, function () {
        var orphanUsers, results, _i, orphanUsers_1, user, official, error_3, successCount, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, findOrphanSupportUsers()];
                case 1:
                    orphanUsers = _a.sent();
                    if (orphanUsers.length === 0) {
                        console.log('Nenhum usuário órfão encontrado para corrigir.');
                        return [2 /*return*/, []];
                    }
                    console.log("Corrigindo ".concat(orphanUsers.length, " usu\u00E1rios \u00F3rf\u00E3os..."));
                    results = [];
                    _i = 0, orphanUsers_1 = orphanUsers;
                    _a.label = 2;
                case 2:
                    if (!(_i < orphanUsers_1.length)) return [3 /*break*/, 7];
                    user = orphanUsers_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, createOfficialForUser(user.id)];
                case 4:
                    official = _a.sent();
                    results.push({
                        userId: user.id,
                        officialId: official.id,
                        success: true
                    });
                    return [3 /*break*/, 6];
                case 5:
                    error_3 = _a.sent();
                    console.error("Falha ao corrigir usu\u00E1rio ".concat(user.id, ":"), error_3);
                    results.push({
                        userId: user.id,
                        success: false,
                        error: String(error_3)
                    });
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7:
                    successCount = results.filter(function (r) { return r.success; }).length;
                    console.log("Corre\u00E7\u00E3o conclu\u00EDda. ".concat(successCount, "/").concat(orphanUsers.length, " usu\u00E1rios corrigidos com sucesso."));
                    return [2 /*return*/, results];
                case 8:
                    error_4 = _a.sent();
                    console.error('Erro ao corrigir usuários órfãos:', error_4);
                    throw error_4;
                case 9: return [2 /*return*/];
            }
        });
    });
}
