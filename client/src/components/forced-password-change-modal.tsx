import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { validatePasswordCriteria, isPasswordValid, type PasswordCriteria } from '@/lib/utils';
import { Check, X, AlertTriangle } from 'lucide-react';

interface ForcedPasswordChangeModalProps {
  userId: number;
  onSuccess: () => void;
}

export function ForcedPasswordChangeModal({ userId, onSuccess }: ForcedPasswordChangeModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordCriteria, setPasswordCriteria] = useState<PasswordCriteria>({
    minLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  const [errors, setErrors] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    general: ''
  });

  // Atualizar critérios de senha em tempo real
  const handlePasswordChange = (password: string) => {
    setFormData(prev => ({ ...prev, newPassword: password }));
    setPasswordCriteria(validatePasswordCriteria(password));
    
    // Limpar erro da nova senha se ela estiver válida
    if (isPasswordValid(password)) {
      setErrors(prev => ({ ...prev, newPassword: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
      general: ''
    });

    try {
      // Validações locais
      if (!formData.oldPassword) {
        setErrors(prev => ({ ...prev, oldPassword: 'Senha atual é obrigatória' }));
        return;
      }

      if (!isPasswordValid(formData.newPassword)) {
        setErrors(prev => ({ ...prev, newPassword: 'A senha não atende aos critérios de segurança' }));
        return;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setErrors(prev => ({ ...prev, confirmPassword: 'As senhas não conferem' }));
        return;
      }

      if (formData.newPassword === '123Mudar@!') {
        setErrors(prev => ({ ...prev, newPassword: 'Você não pode usar a senha padrão. Escolha uma senha diferente.' }));
        return;
      }

      // Enviar para o servidor
      const response = await fetch('/api/auth/change-forced-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          old_password: formData.oldPassword,
          new_password: formData.newPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors(prev => ({ ...prev, general: data.message || 'Erro ao alterar senha' }));
        return;
      }

      toast({
        title: "Senha alterada",
        description: "Sua senha foi alterada com sucesso!",
      });

      onSuccess();
    } catch (error) {
      setErrors(prev => ({ ...prev, general: 'Erro de conexão. Tente novamente.' }));
      toast({
        title: "Erro",
        description: "Erro ao alterar senha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
          </div>
          <CardTitle>Alteração de Senha Obrigatória</CardTitle>
          <CardDescription>
            Por questões de segurança, você deve alterar sua senha antes de continuar.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <Alert variant="destructive">
                <AlertDescription>{errors.general}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Senha Atual</Label>
              <Input
                id="oldPassword"
                type="password"
                placeholder="Digite sua senha atual"
                value={formData.oldPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, oldPassword: e.target.value }))}
                className={errors.oldPassword ? 'border-red-500' : ''}
              />
              {errors.oldPassword && (
                <p className="text-sm text-red-500">{errors.oldPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Digite sua nova senha"
                value={formData.newPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className={errors.newPassword ? 'border-red-500' : ''}
              />
              {errors.newPassword && (
                <p className="text-sm text-red-500">{errors.newPassword}</p>
              )}
              
              {/* Critérios de senha */}
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Critérios da senha:</p>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <div className={`flex items-center gap-1 ${passwordCriteria.minLength ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordCriteria.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Pelo menos 8 caracteres
                  </div>
                  <div className={`flex items-center gap-1 ${passwordCriteria.hasLowercase ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordCriteria.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Pelo menos uma letra minúscula
                  </div>
                  <div className={`flex items-center gap-1 ${passwordCriteria.hasUppercase ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordCriteria.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Pelo menos uma letra maiúscula
                  </div>
                  <div className={`flex items-center gap-1 ${passwordCriteria.hasNumber ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordCriteria.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Pelo menos um número
                  </div>
                  <div className={`flex items-center gap-1 ${passwordCriteria.hasSpecialChar ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordCriteria.hasSpecialChar ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Pelo menos um caractere especial
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua nova senha"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className={errors.confirmPassword ? 'border-red-500' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !isPasswordValid(formData.newPassword)}
            >
              {isLoading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 