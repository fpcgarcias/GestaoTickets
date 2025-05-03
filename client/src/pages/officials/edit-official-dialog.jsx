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
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export function EditOfficialDialog(_a) {
    var _this = this;
    var open = _a.open, onOpenChange = _a.onOpenChange, official = _a.official;
    // Função wrapper para controlar o fechamento do diálogo e limpar estados
    var handleOpenChange = function (isOpen) {
        // Se estiver fechando o diálogo
        if (!isOpen) {
            // Limpar os estados de senha
            setShowPasswordForm(false);
            setPasswordData({ password: '', confirmPassword: '' });
            setPasswordError('');
        }
        // Chamar o manipulador original
        onOpenChange(isOpen);
    };
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var _b = useState({
        name: '',
        email: '',
        username: '',
        isActive: true,
        departments: []
    }), formData = _b[0], setFormData = _b[1];
    // Estado para o formulário de senha
    var _c = useState({
        password: '',
        confirmPassword: ''
    }), passwordData = _c[0], setPasswordData = _c[1];
    var _d = useState(false), showPasswordForm = _d[0], setShowPasswordForm = _d[1];
    var _e = useState(''), passwordError = _e[0], setPasswordError = _e[1];
    var _f = useState(false), submitting = _f[0], setSubmitting = _f[1];
    var _g = useState(false), popoverOpen = _g[0], setPopoverOpen = _g[1];
    
    // Função para obter o username de qualquer estrutura possível de official
    var getUsernameFromOfficial = function(official) {
        if (!official) return '';
        
        // Caso 1: o usuário está na propriedade 'user'
        if (official.user && official.user.username) {
            return official.user.username;
        }
        
        // Caso 2: username está diretamente no atendente
        if (official.username) {
            return official.username;
        }
        
        // Caso 3: pode estar em outra estrutura como userId: {username: ...}
        if (official.userId && typeof official.userId === 'object' && official.userId.username) {
            return official.userId.username;
        }
        
        // Caso 4: pode estar em userData
        if (official.userData && official.userData.username) {
            return official.userData.username;
        }
        
        // Caso 5: fallback para email se nenhum username for encontrado
        return official.email || '';
    };
    
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
    // Carregar dados do atendente quando o componente abrir
    useEffect(function () {
        if (official) {
            console.log('Loading official data:', official);
            
            // Garantir que official.departments seja sempre um array de strings
            var currentDepartments = [];
            if (official.departments) {
                if (Array.isArray(official.departments)) {
                    currentDepartments = official.departments.map(function (d) {
                        return typeof d === 'object' && d !== null && 'department' in d ? d.department : d;
                    }).filter(function (d) { return typeof d === 'string'; });
                }
                else {
                    // Tratar caso inesperado onde official.departments não é array (opcional)
                    console.warn("official.departments não é um array:", official.departments);
                }
            }
            
            var username = getUsernameFromOfficial(official);
            console.log('Username extracted:', username);
            
            setFormData({
                name: official.name,
                email: official.email,
                username: username,
                isActive: official.isActive,
                departments: currentDepartments // Usar o array de strings processado
            });
        }
    }, [official]);
    var toggleDepartment = function (department) {
        setFormData(function (prev) {
            // Trabalhar diretamente com array de strings
            var exists = prev.departments.includes(department);
            if (exists) {
                return __assign(__assign({}, prev), { departments: prev.departments.filter(function (d) { return d !== department; }) });
            }
            else {
                return __assign(__assign({}, prev), { departments: __spreadArray(__spreadArray([], prev.departments, true), [department], false) });
            }
        });
    };
    var removeDepartment = function (department) {
        setFormData(function (prev) { return (__assign(__assign({}, prev), { 
            // Filtrar diretamente o array de strings
            departments: prev.departments.filter(function (d) { return d !== department; }) })); });
    };
    var updateOfficialMutation = useMutation({
        mutationFn: function (data) { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest('PATCH', "/api/officials/".concat(official === null || official === void 0 ? void 0 : official.id), data)];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
            setSubmitting(false);
            handleOpenChange(false);
            toast({
                title: "Atendente atualizado",
                description: "As informações do atendente foram atualizadas com sucesso.",
            });
        },
        onError: function (error) {
            setSubmitting(false);
            toast({
                title: "Erro ao atualizar atendente",
                description: error.message,
                variant: "destructive",
            });
        }
    });
    // Adicionar método para lidar com o toggle do formulário de senha
    var togglePasswordForm = function () {
        setPasswordData({ password: '', confirmPassword: '' }); // Limpar campos de senha
        setPasswordError(''); // Limpar erros de senha
        setShowPasswordForm(!showPasswordForm);
    };
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var updatedData, userObject;
        return __generator(this, function (_a) {
            e.preventDefault();
            // Verificar se pelo menos um departamento foi selecionado
            if (!formData.departments || formData.departments.length === 0) {
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
            
            // Preparar os dados atualizados
            updatedData = __assign({}, formData);
            
            // Remover username do objeto principal, pois é uma propriedade do usuário relacionado
            var userName = updatedData.username;
            delete updatedData.username;
            
            // Determinar como enviar o username com base na estrutura original
            if (official && official.user) {
                // Caso 1: Existe um objeto user
                userObject = __assign(__assign({}, official.user), { username: userName });
            } 
            else if (official && official.userId && typeof official.userId === 'object') {
                // Caso 2: Existe um objeto userId
                userObject = __assign(__assign({}, official.userId), { username: userName });
            }
            else if (official && official.userData) {
                // Caso 3: Existe um objeto userData
                userObject = __assign(__assign({}, official.userData), { username: userName });
            }
            else {
                // Caso 4: Não existe estrutura prévia, criar uma nova
                userObject = {
                    username: userName
                };
            }
            
            // Adicionar a estrutura de user apropriada aos dados de atualização
            if (official && official.user) {
                updatedData.user = userObject;
            } else if (official && official.userId && typeof official.userId === 'object') {
                updatedData.userId = userObject;
            } else if (official && official.userData) {
                updatedData.userData = userObject;
            } else {
                // Tentar a estrutura mais comum
                updatedData.user = userObject;
            }
            
            // Verificar se há senha para atualizar e se as senhas correspondem
            if (showPasswordForm) {
                // Verificar se as senhas correspondem
                if (passwordData.password !== passwordData.confirmPassword) {
                    setPasswordError('As senhas não correspondem');
                    setSubmitting(false);
                    return [2 /*return*/];
                }
                // Verificar se a senha tem pelo menos 6 caracteres
                if (passwordData.password.length < 6) {
                    setPasswordError('A senha deve ter pelo menos 6 caracteres');
                    setSubmitting(false);
                    return [2 /*return*/];
                }
                // Se chegou aqui, a senha é válida, adicionar ao objeto user
                if (updatedData.user) {
                    updatedData.user.password = passwordData.password;
                } else if (updatedData.userId && typeof updatedData.userId === 'object') {
                    updatedData.userId.password = passwordData.password;
                } else if (updatedData.userData) {
                    updatedData.userData.password = passwordData.password;
                }
            }
            
            console.log('Enviando dados de atualização:', updatedData);
            
            // Atualização com dados estruturados corretamente
            updateOfficialMutation.mutate(updatedData);
            return [2 /*return*/];
        });
    }); };
    return (<Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Atendente</DialogTitle>
          <DialogDescription>
            Atualize as informações do atendente.
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
            
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right mt-2">Departamentos</Label>
              <div className="col-span-3 space-y-4">
                {/* Exibir departamentos selecionados */}
                <div className="flex flex-wrap gap-2">
                  {/* Exibir departamentos */}
                  {formData.departments.map(function (dept) {
            var deptInfo = availableDepartments.find(function (d) { return d.value === dept; });
            return (<Badge key={dept} variant="secondary" className="px-3 py-1">
                        {(deptInfo === null || deptInfo === void 0 ? void 0 : deptInfo.label) || dept}
                        <X className="ml-2 h-3 w-3 cursor-pointer" onClick={function () { return removeDepartment(dept); }}/>
                      </Badge>);
        })}
                </div>
                
                {/* Seletor de departamentos */}
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" type="button">
                      <span>Selecionar departamentos</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Pesquisar departamento..."/>
                      <CommandEmpty>Nenhum departamento encontrado.</CommandEmpty>
                      <CommandGroup>
                        {availableDepartments.map(function (dept) { return (<CommandItem key={dept.value} value={dept.value} onSelect={function () {
                toggleDepartment(dept.value);
                setPopoverOpen(false);
            }}>
                            <div className="flex items-center gap-2">
                              <div onClick={function (e) {
                e.stopPropagation();
                toggleDepartment(dept.value);
            }}>
                                <Check className={cn("mr-2 h-4 w-4", 
            // Verificar se dept.value existe no array de strings
            formData.departments.includes(dept.value) ? "opacity-100" : "opacity-0")}/>
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

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select value={formData.isActive ? "active" : "inactive"} onValueChange={function (value) { return setFormData(__assign(__assign({}, formData), { isActive: value === "active" })); }}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione o status"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão para mostrar/ocultar formulário de alteração de senha */}
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right">
                <Label htmlFor="changePassword" className="cursor-pointer select-none">
                  Senha
                </Label>
              </div>
              <div className="col-span-3">
                <Button type="button" variant="outline" onClick={togglePasswordForm} className="w-full justify-start">
                  {showPasswordForm ? "Cancelar alteração de senha" : "Alterar senha"}
                </Button>
              </div>
            </div>

            {/* Formulário de alteração de senha (condicional) */}
            {showPasswordForm && (<>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">
                    Nova Senha
                  </Label>
                  <Input id="password" type="password" value={passwordData.password} onChange={function (e) { return setPasswordData(__assign(__assign({}, passwordData), { password: e.target.value })); }} className="col-span-3" placeholder="Digite a nova senha"/>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="confirmPassword" className="text-right">
                    Confirmar
                  </Label>
                  <div className="col-span-3 space-y-2">
                    <Input id="confirmPassword" type="password" value={passwordData.confirmPassword} onChange={function (e) { return setPasswordData(__assign(__assign({}, passwordData), { confirmPassword: e.target.value })); }} className="w-full" placeholder="Digite a senha novamente"/>
                    {passwordError && (<p className="text-sm text-red-500">{passwordError}</p>)}
                  </div>
                </div>
              </>)}
          </div>
          
          <DialogFooter>
            <Button variant="outline" type="button" onClick={function () { return handleOpenChange(false); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);
}
