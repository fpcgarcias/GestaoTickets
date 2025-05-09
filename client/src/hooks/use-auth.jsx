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
import React, { useState, useEffect, createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
export var AuthContext = createContext(undefined);
export function AuthProvider(_a) {
    var _this = this;
    var children = _a.children;
    var _b = useState(null), user = _b[0], setUser = _b[1];
    var _c = useState(null), error = _c[0], setError = _c[1];
    var _d = useQuery({
        queryKey: ['/api/auth/me'],
        retry: false, // Não tentar novamente em caso de falha
        refetchInterval: false, // Não fazer requisições em intervalo
        refetchOnWindowFocus: false, // Não refetch ao focar a janela
        staleTime: 60 * 1000, // 1 minuto
    }), data = _d.data, isLoading = _d.isLoading, queryError = _d.error;
    // Removido o useEffect de refetch, pois a consulta já está enabled=true
    useEffect(function () {
        if (data) {
            setUser(data);
            setError(null);
        }
        else if (queryError) {
            // Se a consulta falhar, definimos o usuário como nulo (não autenticado)
            console.error('Erro ao verificar usuário:', queryError);
            setUser(null);
        }
    }, [data, queryError]);
    var login = function (username, password, useAD) { return __awaiter(_this, void 0, void 0, function () {
        var response, userData, responseData, errorMsg, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    setError(null);
                    return [4 /*yield*/, fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ username: username, password: password, useAD: useAD })
                    })];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 2:
                    responseData = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    // Se a resposta não for ok, o backend retornou um erro
                    errorMsg = responseData.message || 'Falha ao fazer login';
                    // Criar um erro com dados detalhados
                    var customError = new Error(errorMsg);
                    customError.response = response;
                    customError.data = responseData;
                    throw customError;
                case 3:
                    userData = responseData;
                    setUser(userData);
                    // Atualiza o cache do React Query com os dados do usuário
                    queryClient.setQueryData(['/api/auth/me'], userData);
                    return [2 /*return*/, userData];
                case 4: return [3 /*break*/, 6];
                case 5:
                    err_1 = _a.sent();
                    setError(err_1);
                    throw err_1;
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var logout = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, apiRequest('POST', '/api/auth/logout', {})];
                case 1:
                    _a.sent();
                    setUser(null);
                    // Limpa o cache do React Query para o usuário
                    queryClient.setQueryData(['/api/auth/me'], null);
                    return [3 /*break*/, 3];
                case 2:
                    err_2 = _a.sent();
                    setError(err_2 instanceof Error ? err_2 : new Error('Falha ao fazer logout'));
                    throw err_2;
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var value = {
        user: user,
        isLoading: isLoading,
        error: error,
        login: login,
        logout: logout,
        isAuthenticated: !!user,
        isADUser: !!(user && user.adUser)
    };
    return (<AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>);
}
export function useAuth() {
    var context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
