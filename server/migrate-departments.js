var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
import { db } from './db';
import { sql } from 'drizzle-orm';
export function migrateDepartmentsToJunctionTable() {
    return __awaiter(this, void 0, void 0, function () {
        var error_1, result, officials_2, _i, officials_1, official, existingEntry, error_2, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 15, , 16]);
                    console.log('Iniciando migração de departamentos...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 5]);
                    return [4 /*yield*/, db.execute(sql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["SELECT 1 FROM official_departments LIMIT 1"], ["SELECT 1 FROM official_departments LIMIT 1"]))))];
                case 2:
                    _a.sent();
                    console.log('Tabela official_departments já existe, pulando criação');
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    // Tabela não existe, vamos criá-la
                    console.log('Criando tabela official_departments...');
                    return [4 /*yield*/, db.execute(sql(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        CREATE TABLE official_departments (\n          id SERIAL PRIMARY KEY,\n          official_id INTEGER NOT NULL REFERENCES officials(id),\n          department TEXT NOT NULL,\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL\n        )\n      "], ["\n        CREATE TABLE official_departments (\n          id SERIAL PRIMARY KEY,\n          official_id INTEGER NOT NULL REFERENCES officials(id),\n          department TEXT NOT NULL,\n          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL\n        )\n      "]))))];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 5:
                    _a.trys.push([5, 13, , 14]);
                    return [4 /*yield*/, db.execute(sql(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        SELECT id, department FROM officials WHERE department IS NOT NULL\n      "], ["\n        SELECT id, department FROM officials WHERE department IS NOT NULL\n      "]))))];
                case 6:
                    result = _a.sent();
                    officials_2 = result.rows || [];
                    console.log("Encontrados ".concat(officials_2.length, " atendentes com departamentos para migrar"));
                    _i = 0, officials_1 = officials_2;
                    _a.label = 7;
                case 7:
                    if (!(_i < officials_1.length)) return [3 /*break*/, 12];
                    official = officials_1[_i];
                    if (!official.department) return [3 /*break*/, 11];
                    return [4 /*yield*/, db.execute(sql(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n            SELECT id FROM official_departments \n            WHERE official_id = ", " AND department = ", "\n            LIMIT 1\n          "], ["\n            SELECT id FROM official_departments \n            WHERE official_id = ", " AND department = ", "\n            LIMIT 1\n          "])), official.id, official.department))];
                case 8:
                    existingEntry = _a.sent();
                    if (!(!existingEntry.rows || existingEntry.rows.length === 0)) return [3 /*break*/, 10];
                    // Inserir na nova tabela de junção
                    return [4 /*yield*/, db.execute(sql(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n              INSERT INTO official_departments (official_id, department)\n              VALUES (", ", ", ")\n            "], ["\n              INSERT INTO official_departments (official_id, department)\n              VALUES (", ", ", ")\n            "])), official.id, official.department))];
                case 9:
                    // Inserir na nova tabela de junção
                    _a.sent();
                    console.log("Migrado departamento ".concat(official.department, " para atendente ").concat(official.id));
                    return [3 /*break*/, 11];
                case 10:
                    console.log("Departamento ".concat(official.department, " j\u00E1 existe para atendente ").concat(official.id, ", pulando"));
                    _a.label = 11;
                case 11:
                    _i++;
                    return [3 /*break*/, 7];
                case 12:
                    console.log('Migração de departamentos concluída com sucesso!');
                    return [3 /*break*/, 14];
                case 13:
                    error_2 = _a.sent();
                    // A coluna department provavelmente não existe mais
                    console.log('Coluna department não encontrada, migração não é necessária');
                    return [3 /*break*/, 14];
                case 14: return [2 /*return*/, true];
                case 15:
                    error_3 = _a.sent();
                    console.error('Erro ao migrar departamentos:', error_3);
                    return [2 /*return*/, false];
                case 16: return [2 /*return*/];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
