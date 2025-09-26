import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCNPJ, cleanCNPJ, isValidCNPJ, validatePasswordCriteria, isPasswordValid, type PasswordCriteria } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { Check, X } from 'lucide-react';
import { ForcedPasswordChangeModal } from '@/components/forced-password-change-modal';

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { user, login, isLoading, error, mustChangePassword, clearMustChangePassword } = useAuth();
  const { toast } = useToast();
  // Usar nome da empresa baseado no tema do contexto
  const { companyName, companyLogo } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('login');
  
  // Formulário de login
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });
  
  // Formulário de registro
  const [registerData, setRegisterData] = useState({
    password: '',
    confirmPassword: '',
    name: '',
    email: '',
    cnpj: '',
    role: 'customer' as const // Forçar sempre como customer
  });
  
  // Estado para validação de senha
  const [passwordCriteria, setPasswordCriteria] = useState<PasswordCriteria>({
    minLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  
  // Estado para erros
  const [errors, setErrors] = useState({
    password: '',
    confirmPassword: '',
    cnpj: ''
  });
  
  // Se o usuário já estiver logado, redirecionar para a página inicial
  // Usamos useEffect para evitar erro de atualização durante renderização
  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);
  
  // Atualizar critérios de senha em tempo real
  useEffect(() => {
    setPasswordCriteria(validatePasswordCriteria(registerData.password));
  }, [registerData.password]);
  
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginData.username, loginData.password);
      // Se chegou até aqui e não há modal de troca de senha, login foi bem-sucedido
      if (!mustChangePassword.show) {
        toast({
          title: "Login realizado",
          description: "Você foi autenticado com sucesso.",
        });
        setLocation('/');
      }
    } catch (err) {
      toast({
        title: "Erro no login",
        description: "Credenciais inválidas. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handlePasswordChangeSuccess = async () => {
    // Após trocar a senha com sucesso, tentar fazer login novamente
    try {
      clearMustChangePassword();
      await login(loginData.username, loginData.password);
      toast({
        title: "Login realizado",
        description: "Senha alterada e login realizado com sucesso!",
      });
      setLocation('/');
    } catch (err) {
      toast({
        title: "Erro no login",
        description: "Erro ao fazer login após trocar senha. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({
      password: '',
      confirmPassword: '',
      cnpj: ''
    });
    
    // Verificar se o CNPJ é válido
    if (!isValidCNPJ(registerData.cnpj)) {
      setErrors(prev => ({
        ...prev,
        cnpj: 'CNPJ inválido'
      }));
      return;
    }
    
    // Verificar se a senha atende aos critérios de segurança
    if (!isPasswordValid(registerData.password)) {
      setErrors(prev => ({
        ...prev,
        password: 'A senha não atende aos critérios de segurança'
      }));
      return;
    }
    
    // Verificar se as senhas correspondem
    if (registerData.password !== registerData.confirmPassword) {
      setErrors(prev => ({
        ...prev,
        confirmPassword: 'As senhas não correspondem'
      }));
      return;
    }
      
    try {
      // Configurar dados do usuário (sempre como customer)
      const userData = {
        name: registerData.name,
        email: registerData.email,
        password: registerData.password,
        username: registerData.email,
        cnpj: cleanCNPJ(registerData.cnpj),
        role: 'customer' // Sempre customer para auto-cadastro
      };
      
      // Fazer chamada API para registrar usuário
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao registrar usuário');
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
        cnpj: '',
        role: 'customer'
      });
      
      // Limpar erros
      setErrors({
        password: '',
        confirmPassword: '',
        cnpj: ''
      });
      
      // Mudar para o tab de login
      setActiveTab('login');
    } catch (err) {
      toast({
        title: "Erro no registro",
        description: err instanceof Error ? err.message : "Erro ao criar conta.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="flex min-h-screen bg-background">
      {/* Lado esquerdo - Formulário */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              {companyLogo ? (
                <div className="flex justify-center mb-2">
                  <img 
                    src={companyLogo} 
                    alt={companyName} 
                    className="h-12 w-auto max-w-[200px] object-contain"
                    style={{ maxHeight: '48px' }}
                  />
                </div>
              ) : (
                companyName
              )}
            </CardTitle>
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
                    <Label htmlFor="username">Email</Label>
                    <Input 
                      id="username" 
                      type="email" 
                      placeholder="seu.email@exemplo.com" 
                      value={loginData.username}
                      onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="Sua senha" 
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      required
                    />
                  </div>
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
                    <Input 
                      id="reg-name" 
                      type="text" 
                      placeholder="Seu nome completo" 
                      value={registerData.name}
                      onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input 
                      id="reg-email" 
                      type="email" 
                      placeholder="seu.email@exemplo.com" 
                      value={registerData.email}
                      onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-cnpj">CNPJ da Empresa</Label>
                    <Input 
                      id="reg-cnpj" 
                      type="text" 
                      placeholder="00.000.000/0001-00" 
                      value={formatCNPJ(registerData.cnpj)}
                      onChange={(e) => setRegisterData({...registerData, cnpj: cleanCNPJ(e.target.value)})}
                      required
                    />
                    {errors.cnpj && (
                      <p className="text-sm text-red-500">{errors.cnpj}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Senha</Label>
                    <Input 
                      id="reg-password" 
                      type="password" 
                      placeholder="Crie uma senha forte" 
                      value={registerData.password}
                      onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                      required
                    />
                    {errors.password && (
                      <p className="text-sm text-red-500">{errors.password}</p>
                    )}
                    
                    {/* Feedback visual dos critérios de senha */}
                    {registerData.password && (
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-gray-700">Critérios de segurança:</p>
                        <div className="space-y-1">
                          <div className={`flex items-center gap-2 ${passwordCriteria.minLength ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordCriteria.minLength ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            <span>Pelo menos 8 caracteres</span>
                          </div>
                          <div className={`flex items-center gap-2 ${passwordCriteria.hasLowercase ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordCriteria.hasLowercase ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            <span>Pelo menos uma letra minúscula (a-z)</span>
                          </div>
                          <div className={`flex items-center gap-2 ${passwordCriteria.hasUppercase ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordCriteria.hasUppercase ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            <span>Pelo menos uma letra maiúscula (A-Z)</span>
                          </div>
                          <div className={`flex items-center gap-2 ${passwordCriteria.hasNumber ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordCriteria.hasNumber ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            <span>Pelo menos um número (0-9)</span>
                          </div>
                          <div className={`flex items-center gap-2 ${passwordCriteria.hasSpecialChar ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordCriteria.hasSpecialChar ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            <span>Pelo menos um caractere especial (@$!%*?&)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm-password">Confirmar Senha</Label>
                    <Input 
                      id="reg-confirm-password" 
                      type="password" 
                      placeholder="Digite a senha novamente" 
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                      required
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={!isPasswordValid(registerData.password) || registerData.password !== registerData.confirmPassword || !isValidCNPJ(registerData.cnpj)}
                  >
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
          <h1 className="text-4xl font-bold mb-4">
            {companyLogo ? (
              <div className="flex justify-center mb-4">
                <img 
                  src={companyLogo} 
                  alt={companyName} 
                  className="h-16 w-auto max-w-[280px] object-contain"
                  style={{ maxHeight: '64px' }}
                />
              </div>
            ) : (
              companyName
            )}
          </h1>
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
      
      {/* Modal de troca de senha obrigatória */}
      {mustChangePassword.show && mustChangePassword.userId && (
        <ForcedPasswordChangeModal
          userId={mustChangePassword.userId}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}
    </div>
  );
}
