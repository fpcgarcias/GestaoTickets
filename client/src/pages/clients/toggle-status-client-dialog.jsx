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
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2, UserCog } from 'lucide-react';
export default function ToggleStatusClientDialog(_a) {
    var _this = this;
    var open = _a.open, onOpenChange = _a.onOpenChange, client = _a.client;
    var toast = useToast().toast;
    var toggleStatusMutation = useMutation({
        mutationFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!client)
                            throw new Error('Cliente não selecionado');
                        return [4 /*yield*/, apiRequest('DELETE', "/api/customers/".concat(client.id))];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function (data) {
            queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
            onOpenChange(false);
            toast({
                title: data.inactive ? 'Cliente inativado com sucesso' : 'Cliente removido com sucesso',
                description: data.inactive ? 'O cliente foi inativado e não poderá mais acessar o sistema' : 'O cliente foi removido do sistema',
                variant: 'default',
            });
        },
        onError: function (error) {
            toast({
                title: 'Erro ao inativar/remover cliente',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
    var handleConfirm = function () {
        toggleStatusMutation.mutate();
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Inativar Cliente</DialogTitle>
          <DialogDescription>
            Ao inativar um cliente, ele não poderá mais acessar o sistema, mas seus dados serão mantidos para fins de histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
            <div className="mr-3">
              <UserCog className="h-5 w-5 text-amber-600"/>
            </div>
            <div>
              <p className="font-medium">{client === null || client === void 0 ? void 0 : client.name}</p>
              <p className="text-sm text-neutral-500">{client === null || client === void 0 ? void 0 : client.email}</p>
              {(client === null || client === void 0 ? void 0 : client.company) && (<p className="text-sm text-neutral-500">{client.company}</p>)}
            </div>
          </div>
          
          <p className="text-sm text-neutral-600 mb-6">
            Esta ação não exclui o cliente permanentemente. Os dados serão mantidos para histórico, mas o cliente não poderá mais acessar o sistema.
          </p>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={function () { return onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={toggleStatusMutation.isPending || !client}>
              {toggleStatusMutation.isPending ? (<>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Processando...
                </>) : ('Confirmar Inativação')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>);
}
