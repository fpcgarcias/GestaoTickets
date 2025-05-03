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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
export default function EditClientDialog(_a) {
    var _this = this;
    var open = _a.open, onOpenChange = _a.onOpenChange, client = _a.client;
    var toast = useToast().toast;
    var _b = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        password: '',
        confirmPassword: ''
    }), formData = _b[0], setFormData = _b[1];
    // Atualizar o formulário quando o cliente selecionado mudar
    useEffect(function () {
        if (client) {
            setFormData({
                name: client.name || '',
                email: client.email || '',
                phone: client.phone || '',
                company: client.company || '',
                password: '',
                confirmPassword: ''
            });
        }
    }, [client]);
    var handleChange = function (e) {
        var _a = e.target, name = _a.name, value = _a.value;
        setFormData(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[name] = value, _a)));
        });
    };
    var updateClientMutation = useMutation({
        mutationFn: function (data) { return __awaiter(_this, void 0, void 0, function () {
            var dataToSend, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!client)
                            throw new Error('Cliente não selecionado');
                        dataToSend = __assign({}, data);
                        if (!data.password) {
                            delete dataToSend.password;
                            delete dataToSend.confirmPassword;
                        }
                        return [4 /*yield*/, apiRequest('PATCH', "/api/customers/".concat(client.id), dataToSend)];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
            onOpenChange(false);
            toast({
                title: 'Cliente atualizado com sucesso',
                description: 'As informações do cliente foram atualizadas',
                variant: 'default',
            });
            // Limpar campos de senha
            setFormData(function (prev) { return (__assign(__assign({}, prev), { password: '', confirmPassword: '' })); });
        },
        onError: function (error) {
            toast({
                title: 'Erro ao atualizar cliente',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
    var handleSubmit = function (e) {
        e.preventDefault();
        // Validação básica
        if (!formData.name.trim()) {
            toast({
                title: 'Erro de validação',
                description: 'O nome do cliente é obrigatório',
                variant: 'destructive',
            });
            return;
        }
        if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
            toast({
                title: 'Erro de validação',
                description: 'Email inválido',
                variant: 'destructive',
            });
            return;
        }
        // Verificar se senhas coincidem caso tenham sido preenchidas
        if (formData.password && formData.password !== formData.confirmPassword) {
            toast({
                title: 'Erro de validação',
                description: 'As senhas não coincidem',
                variant: 'destructive',
            });
            return;
        }
        // Verificar comprimento mínimo da senha caso tenha sido preenchida
        if (formData.password && formData.password.length < 6) {
            toast({
                title: 'Erro de validação',
                description: 'A senha deve ter pelo menos 6 caracteres',
                variant: 'destructive',
            });
            return;
        }
        updateClientMutation.mutate(formData);
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações do cliente selecionado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Cliente *</Label>
            <Input id="name" name="name" placeholder="Digite o nome do cliente" value={formData.name} onChange={handleChange} required/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" placeholder="Digite o email do cliente" value={formData.email} onChange={handleChange} required/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" name="phone" placeholder="Digite o telefone do cliente" value={formData.phone} onChange={handleChange}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input id="company" name="company" placeholder="Digite o nome da empresa" value={formData.company} onChange={handleChange}/>
          </div>
          
          <div className="pt-4">
            <h4 className="text-sm font-medium mb-2">Alterar Senha (opcional)</h4>
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input id="password" name="password" type="password" placeholder="Digite a nova senha" value={formData.password} onChange={handleChange}/>
            </div>
            <div className="space-y-2 mt-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Confirme a nova senha" value={formData.confirmPassword} onChange={handleChange}/>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={function () { return onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateClientMutation.isPending}>
              {updateClientMutation.isPending ? (<>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Salvando...
                </>) : ('Salvar Alterações')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>);
}
