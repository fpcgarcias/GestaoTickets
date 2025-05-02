import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useSystemSettings } from '@/hooks/use-system-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { user, login, isLoading, error } = useAuth();
  const { toast } = useToast();
  const { companyName } = useSystemSettings();
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
    role: 'customer' as 'customer' | 'support' | 'admin'
  });
  
  // Estado para erros de senha
  const [passwordError, setPasswordError] = useState('');
  
  // Se o usuário já estiver logado, redirecionar para a página inicial
  // Usamos useEffect para evitar erro de atualização durante renderização
  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);
  
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginData.username, loginData.password);
      toast({
        title: "Login realizado",
        description: "Você foi autenticado com sucesso.",
      });
      setLocation('/');
    } catch (err) {
      toast({
        title: "Erro no login",
        description: "Credenciais inválidas. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    // Verificar se as senhas correspondem
    if (registerData.password !== registerData.confirmPassword) {
      setPasswordError('As senhas não correspondem');
      return;
    }
    
    // Verificar se a senha tem pelo menos 6 caracteres
    if (registerData.password.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
      
    try {
      // Configurar username como o email
      const userData = {
        ...registerData,
        username: registerData.email
      };
      
      // Fazer chamada API para registrar usuário
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
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
    } catch (err) {
      toast({
        title: "Erro no registro",
        description: err instanceof Error ? err.message : "Erro ao criar conta.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
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
                    <Input 
                      id="username" 
                      type="text" 
                      placeholder="Seu nome de usuário" 
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
                  {/* Campo de nome de usuário removido, o email será usado como username */}
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
                    {passwordError && (
                      <p className="text-sm text-red-500">{passwordError}</p>
                    )}
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
          <h1 className="text-4xl font-bold mb-4">{companyName}</h1>
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
    </div>
  );
}
