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
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
export default function AuthPage() {
    var _this = this;
    var _a = useLocation(), location = _a[0], setLocation = _a[1];
    var _b = useAuth(), user = _b.user, login = _b.login, isLoading = _b.isLoading, error = _b.error;
    var toast = useToast().toast;
    // Usar valor fixo padrão para evitar loops de autenticação
    var companyName = "Vix Brasil";
    var _c = useState('login'), activeTab = _c[0], setActiveTab = _c[1];
    // Formulário de login
    var _d = useState({
        username: '',
        password: '',
        useAD: false
    }), loginData = _d[0], setLoginData = _d[1];
    // Formulário de registro
    var _e = useState({
        password: '',
        confirmPassword: '',
        name: '',
        email: '',
        role: 'customer'
    }), registerData = _e[0], setRegisterData = _e[1];
    // Estado para erros de senha
    var _f = useState(''), passwordError = _f[0], setPasswordError = _f[1];
    // Se o usuário já estiver logado, redirecionar para a página inicial
    // Usamos useEffect para evitar erro de atualização durante renderização
    useEffect(function () {
        if (user) {
            setLocation('/');
        }
    }, [user, setLocation]);
    var handleLoginSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, login(loginData.username, loginData.password, loginData.useAD)];
                case 2:
                    _a.sent();
                    toast({
                        title: "Login realizado",
                        description: "Você foi autenticado com sucesso.",
                    });
                    setLocation('/');
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.error('Erro no login:', err_1);
                    
                    // Verificar se a resposta contém um erro específico sobre email não encontrado
                    let errorMessage = "Credenciais inválidas. Tente novamente.";
                    
                    // Agora podemos acessar os dados diretamente do objeto de erro
                    if (err_1 && err_1.data) {
                        if (err_1.data.message && err_1.data.message.includes("E-mail não encontrado")) {
                            errorMessage = err_1.data.details || "E-mail não encontrado no Active Directory. Contate o administrador do sistema.";
                        }
                    }
                    
                    toast({
                        title: "Erro no login",
                        description: errorMessage,
                        variant: "destructive",
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleRegisterSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var userData, response, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setPasswordError('');
                    // Verificar se as senhas correspondem
                    if (registerData.password !== registerData.confirmPassword) {
                        setPasswordError('As senhas não correspondem');
                        return [2 /*return*/];
                    }
                    // Verificar se a senha tem pelo menos 6 caracteres
                    if (registerData.password.length < 6) {
                        setPasswordError('A senha deve ter pelo menos 6 caracteres');
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    userData = __assign(__assign({}, registerData), { username: registerData.email });
                    return [4 /*yield*/, fetch('/api/register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(userData)
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error('Falha ao registrar usuário');
                    }
                    toast({
                        title: "Registro realizado",
                        description: "Conta criada com sucesso. Faça login.",
                    });
                    // Limpar o formulário
                    setRegisterData({
                        password: '',
                        confirmPassword: '',
                        name: '',
                        email: '',
                        role: 'customer'
                    });
                    // Limpar erros de senha
                    setPasswordError('');
                    // Mudar para o tab de login
                    setActiveTab('login');
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _a.sent();
                    toast({
                        title: "Erro no registro",
                        description: err_2 instanceof Error ? err_2.message : "Erro ao criar conta.",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Lado esquerdo - Formulário */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">{companyName}</CardTitle>
            <CardDescription className="text-center">Sistema de Gestão de Chamados</CardDescription>
          </CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Registro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit}>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuário</Label>
                    <Input id="username" type="text" placeholder="Seu nome de usuário" value={loginData.username} onChange={function (e) { return setLoginData(__assign(__assign({}, loginData), { username: e.target.value })); }} required/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" placeholder="Sua senha" value={loginData.password} onChange={function (e) { return setLoginData(__assign(__assign({}, loginData), { password: e.target.value })); }} required/>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="use-ad" 
                      checked={loginData.useAD} 
                      onCheckedChange={(checked) => 
                        setLoginData(__assign(__assign({}, loginData), { useAD: !!checked }))
                      }
                    />
                    <Label htmlFor="use-ad" className="cursor-pointer">Autenticar com Active Directory</Label>
                  </div>
                  {loginData.useAD && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                      <p>Digite seu nome de usuário do AD sem o domínio (ex: <strong>joao.silva</strong>)</p>
                      <p>Se preferir, use o formato completo: <strong>usuario@vixbrasil.local</strong></p>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegisterSubmit}>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Nome Completo</Label>
                    <Input id="reg-name" type="text" placeholder="Seu nome completo" value={registerData.name} onChange={function (e) { return setRegisterData(__assign(__assign({}, registerData), { name: e.target.value })); }} required/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" type="email" placeholder="seu.email@exemplo.com" value={registerData.email} onChange={function (e) { return setRegisterData(__assign(__assign({}, registerData), { email: e.target.value })); }} required/>
                  </div>
                  {/* Campo de nome de usuário removido, o email será usado como username */}
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Senha</Label>
                    <Input id="reg-password" type="password" placeholder="Crie uma senha forte" value={registerData.password} onChange={function (e) { return setRegisterData(__assign(__assign({}, registerData), { password: e.target.value })); }} required/>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm-password">Confirmar Senha</Label>
                    <Input id="reg-confirm-password" type="password" placeholder="Digite a senha novamente" value={registerData.confirmPassword} onChange={function (e) { return setRegisterData(__assign(__assign({}, registerData), { confirmPassword: e.target.value })); }} required/>
                    {passwordError && (<p className="text-sm text-red-500">{passwordError}</p>)}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">
                    Criar Conta
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      
      {/* Lado direito - Informações do produto */}
      <div className="flex-1 bg-primary text-white p-8 hidden md:flex flex-col justify-center">
        <div className="max-w-lg mx-auto">
          <h1 className="text-4xl font-bold mb-4">Vix Brasil</h1>
          <h2 className="text-2xl font-semibold mb-6">Sistema Completo de Gestão de Chamados</h2>
          
          <ul className="space-y-4">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Cadastro e gerenciamento de tickets com status e prioridades</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Departamentos personalizáveis com equipes de atendimento</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Níveis de SLA e monitoramento de tempos de resposta</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Notificações em tempo real para atualizações de tickets</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Dashboard com estatísticas e indicadores de performance</span>
            </li>
          </ul>
        </div>
      </div>
    </div>);
}
