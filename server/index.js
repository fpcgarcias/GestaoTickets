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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import express from "express";
import { registerRoutes } from "./routes";
import { log } from "./vite";
import session from "express-session";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";
import { migrateIncidentTypes } from "./migrations/migrate-incident-types";
// Carregar variáveis de ambiente
dotenv.config();
// Para garantir que temos um secret único a cada inicialização
var generateSecret = function () { return crypto.randomBytes(32).toString('hex'); };
var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Inicializar serviço de notificações 
var notificationService = {
    initialize: function () {
        console.log('Serviço de notificações inicializado');
        // Verificar se há usuários órfãos no sistema
        setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
            var findOrphanSupportUsers, orphanUsers, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, import('./clean-orphan-users')];
                    case 1:
                        findOrphanSupportUsers = (_a.sent()).findOrphanSupportUsers;
                        return [4 /*yield*/, findOrphanSupportUsers()];
                    case 2:
                        orphanUsers = _a.sent();
                        if (orphanUsers.length > 0) {
                            console.log("Aviso: Foram encontrados ".concat(orphanUsers.length, " usu\u00E1rios de suporte sem registro de atendente."));
                            console.log('Para corrigir, execute a função fixAllOrphanSupportUsers() do módulo clean-orphan-users.');
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Erro ao verificar usuários órfãos:', error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); }, 5000); // Aguardar 5 segundos para não atrapalhar a inicialização
    }
};
// Inicializar serviço
notificationService.initialize();
// Configurar a sessão
app.use(session({
    secret: process.env.SESSION_SECRET || generateSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Desativando secure para permitir cookies em HTTP
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 dia
    }
}));
app.use(function (req, res, next) {
    var start = Date.now();
    var path = req.path;
    var capturedJsonResponse = undefined;
    var originalResJson = res.json;
    res.json = function (bodyJson) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, __spreadArray([bodyJson], args, true));
    };
    res.on("finish", function () {
        var duration = Date.now() - start;
        if (path.startsWith("/api")) {
            var logLine = "".concat(req.method, " ").concat(path, " ").concat(res.statusCode, " in ").concat(duration, "ms");
            if (capturedJsonResponse) {
                logLine += " :: ".concat(JSON.stringify(capturedJsonResponse));
            }
            if (logLine.length > 80) {
                logLine = logLine.slice(0, 79) + "…";
            }
            log(logLine);
        }
    });
    next();
});
// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));
// Registrar rotas da API
var start = function () { return __awaiter(void 0, void 0, void 0, function () {
    var server, PORT_1, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                console.log("Iniciando o servidor...");
                return [4 /*yield*/, registerRoutes(app)];
            case 1:
                server = _a.sent();
                // Executar migrações
                console.log("Executando migrações...");
                return [4 /*yield*/, migrateIncidentTypes()];
            case 2:
                _a.sent();
                PORT_1 = process.env.PORT || 3001;
                server.listen(PORT_1, function () {
                    console.log("Servidor rodando na porta ".concat(PORT_1));
                });
                return [3 /*break*/, 4];
            case 3:
                error_2 = _a.sent();
                console.error("Erro ao iniciar o servidor:", error_2);
                process.exit(1);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
start();
