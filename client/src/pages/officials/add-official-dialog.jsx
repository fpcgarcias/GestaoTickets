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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, X, ChevronsUpDown, Copy } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
function generateRandomPassword() {
    return Math.random().toString(36).slice(-8);
}
export function AddOfficialDialog(_a) {
    var _this = this;
    var open = _a.open, onOpenChange = _a.onOpenChange, onCreated = _a.onCreated;
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var _b = useState({
        name: '',
        email: '',
        username: '',
        departments: [],
        userId: null,
        isActive: true,
        avatarUrl: null,
    }), formData = _b[0], setFormData = _b[1];
    var _c = useState(false), submitting = _c[0], setSubmitting = _c[1];
    var _d = useState(false), userCreated = _d[0], setUserCreated = _d[1];
    var _e = useState(''), generatedPassword = _e[0], setGeneratedPassword = _e[1];
    var _f = useState(false), popoverOpen = _f[0], setPopoverOpen = _f[1];
    // Carregar departamentos disponíveis
    var departmentsData = useQuery({
        queryKey: ["/api/settings/departments"],
    }).data;
    // Departamentos disponíveis para seleção
    var availableDepartments = [
        { value: "technical", label: "Suporte Técnico" },
        { value: "billing", label: "Faturamento" },
        { value: "general", label: "Atendimento Geral" },
        { value: "sales", label: "Vendas" },
        { value: "other", label: "Outro" }
    ];
    var toggleDepartment = function (department) {
        setFormData(function (prev) {
            if (prev.departments.includes(department)) {
                return __assign(__assign({}, prev), { departments: prev.departments.filter(function (d) { return d !== department; }) });
            }
            else {
                return __assign(__assign({}, prev), { departments: __spreadArray(__spreadArray([], prev.departments, true), [department], false) });
            }
        });
    };
    var removeDepartment = function (department) {
        setFormData(function (prev) { return (__assign(__assign({}, prev), { departments: prev.departments.filter(function (d) { return d !== department; }) })); });
    };
    var createOfficialMutation = useMutation({
        mutationFn: function (data) { return __awaiter(_this, void 0, void 0, function () {
            var res, errorData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest('POST', '/api/officials', data)];
                    case 1:
                        res = _a.sent();
                        if (!!res.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, res.json()];
                    case 2:
                        errorData = _a.sent();
                        throw new Error(errorData.message || 'Erro ao criar atendente');
                    case 3: return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
            setSubmitting(false);
            setUserCreated(true);
            toast({
                title: "Atendente adicionado",
                description: "O atendente foi adicionado com sucesso.",
            });
        },
        onError: function (error) {
            setSubmitting(false);
            toast({
                title: "Erro ao adicionar atendente",
                description: error.message,
                variant: "destructive",
            });
        }
    });
    var createSupportUserMutation = useMutation({
        mutationFn: function (userData) { return __awaiter(_this, void 0, void 0, function () {
            var res, errorData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('Enviando dados para criar usuário de suporte:', JSON.stringify(userData, null, 2));
                        return [4 /*yield*/, apiRequest('POST', '/api/support-users', userData)];
                    case 1:
                        res = _a.sent();
                        if (!!res.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, res.json()];
                    case 2:
                        errorData = _a.sent();
                        throw new Error(errorData.message || errorData.error || 'Erro ao criar usuário e atendente');
                    case 3: return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function (data) {
            setSubmitting(false);
            // Mostrar mensagem de sucesso e senha gerada
            toast({
                title: "Atendente criado com sucesso",
                description: "Senha para primeiro acesso: ".concat(generatedPassword),
                variant: "default",
                duration: 10000, // 10 segundos para copiar a senha
            });
            // Fechar o diálogo e resetar o formulário
            handleCloseDialog();
            onCreated && onCreated(data.official);
        },
        onError: function (error) {
            setSubmitting(false);
            toast({
                title: "Erro ao criar atendente",
                description: error.message,
                variant: "destructive",
            });
        }
    });
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var password;
        return __generator(this, function (_a) {
            e.preventDefault();
            // Verificar se pelo menos um departamento foi selecionado
            if (!formData.departments.length) {
                toast({
                    title: "Erro de validação",
                    description: "Selecione pelo menos um departamento para o atendente.",
                    variant: "destructive",
                });
                return [2 /*return*/];
            }
            
            // Verificar se o nome de login foi fornecido
            if (!formData.username.trim()) {
                toast({
                    title: "Erro de validação",
                    description: "O nome de login é obrigatório.",
                    variant: "destructive",
                });
                return [2 /*return*/];
            }
            
            setSubmitting(true);
            password = generateRandomPassword();
            setGeneratedPassword(password);
            // Criar o usuário e atendente em uma única operação
            // Estruturando os dados conforme a API espera
            createSupportUserMutation.mutate({
                username: formData.username,
                email: formData.email,
                password: password,
                name: formData.name,
                departments: formData.departments,
                userDepartments: formData.departments,
                isActive: true,
                avatarUrl: null
            });
            return [2 /*return*/];
        });
    }); };
    var handleCloseDialog = function () {
        // Reset form data when closing
        setFormData({
            name: '',
            email: '',
            username: '',
            departments: [],
            userId: null,
            isActive: true,
            avatarUrl: null,
        });
        setUserCreated(false);
        setGeneratedPassword('');
        onOpenChange(false);
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {!userCreated ? (<>
            <DialogHeader>
              <DialogTitle>Adicionar Atendente</DialogTitle>
              <DialogDescription>
                Adicione um novo membro à sua equipe de suporte.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nome
                  </Label>
                  <Input id="name" value={formData.name} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { name: e.target.value })); }} className="col-span-3" required/>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="username" className="text-right">
                    Login
                  </Label>
                  <Input id="username" value={formData.username} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { username: e.target.value })); }} className="col-span-3" required/>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    Email
                  </Label>
                  <Input id="email" type="email" value={formData.email} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { email: e.target.value })); }} className="col-span-3" required/>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">
                    Departamentos
                  </Label>
                  <div className="col-span-3 space-y-2">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {formData.departments.map(function (dept) { return (<Badge key={dept} variant="secondary" className="gap-1">
                          {dept === 'technical' && 'Suporte Técnico'}
                          {dept === 'billing' && 'Faturamento'}
                          {dept === 'general' && 'Atendimento Geral'}
                          {dept === 'sales' && 'Vendas'}
                          {dept === 'other' && 'Outro'}
                          <button type="button" className="rounded-full outline-none hover:bg-neutral-200 flex items-center justify-center" onClick={function () { return removeDepartment(dept); }}>
                            <X className="h-3 w-3"/>
                          </button>
                        </Badge>); })}
                      {formData.departments.length === 0 && (<span className="text-sm text-neutral-500">Nenhum departamento selecionado</span>)}
                    </div>
                    
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={popoverOpen} className="w-full justify-between">
                          <span>Selecionar departamentos</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Buscar departamento..." className="h-9"/>
                          <CommandEmpty>Nenhum departamento encontrado.</CommandEmpty>
                          <CommandGroup>
                            {availableDepartments.map(function (dept) { return (<CommandItem key={dept.value} value={dept.value} onSelect={function () {
                    // Selecionar departamento quando item for clicado
                    toggleDepartment(dept.value);
                }}>
                                <div className="flex items-center gap-2">
                                  <div onClick={function (e) {
                    e.stopPropagation();
                    toggleDepartment(dept.value);
                }}>
                                    <Checkbox checked={formData.departments.includes(dept.value)} className="mr-2"/>
                                  </div>
                                  <span onClick={function (e) {
                    e.stopPropagation();
                    toggleDepartment(dept.value);
                }}>
                                    {dept.label}
                                  </span>
                                </div>
                              </CommandItem>); })}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Adicionando..." : "Adicionar Atendente"}
                </Button>
              </DialogFooter>
            </form>
          </>) : (<>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <CheckCircle className="mr-2 h-6 w-6 text-green-600"/>
                Atendente Adicionado
              </DialogTitle>
              <DialogDescription>
                O atendente foi adicionado com sucesso.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="mb-4">
                <p className="font-medium mb-1">Dados de Acesso:</p>
                <p><strong>Nome de Usuário (Login):</strong> {formData.username}</p>
                <p><strong>Email:</strong> {formData.email}</p>
                <p className="flex items-center gap-2">
                  <strong>Senha Temporária:</strong> {generatedPassword}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword);
                      toast({
                        title: "Senha copiada",
                        description: "A senha foi copiada para a área de transferência.",
                        duration: 3000,
                      });
                    }}
                    className="h-6 w-6"
                    type="button"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
                <p className="text-amber-800 text-sm">
                  Anote a senha temporária! Ela não poderá ser recuperada depois que esta janela for fechada.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleCloseDialog}>Fechar</Button>
            </DialogFooter>
          </>)}
      </DialogContent>
    </Dialog>);
}
