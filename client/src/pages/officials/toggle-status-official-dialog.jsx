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
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserX, UserCheck, UserCog } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
export function ToggleStatusOfficialDialog(_a) {
    var _this = this;
    var open = _a.open, onOpenChange = _a.onOpenChange, official = _a.official;
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var _b = useState(false), processing = _b[0], setProcessing = _b[1];
    var toggleStatusMutation = useMutation({
        mutationFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(official === null || official === void 0 ? void 0 : official.id))
                            return [2 /*return*/];
                        return [4 /*yield*/, apiRequest('PATCH', "/api/officials/".concat(official.id, "/toggle-active"), {})];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function (data) {
            queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
            setProcessing(false);
            onOpenChange(false);
            toast({
                title: data.isActive ? "Atendente ativado" : "Atendente desativado",
                description: data.isActive
                    ? "O atendente foi ativado com sucesso."
                    : "O atendente foi desativado com sucesso.",
            });
        },
        onError: function (error) {
            setProcessing(false);
            toast({
                title: "Erro ao alterar status do atendente",
                description: error.message,
                variant: "destructive",
            });
        }
    });
    var handleToggleStatus = function () {
        setProcessing(true);
        toggleStatusMutation.mutate();
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {official && official.isActive ? "Desativar atendente" : "Ativar atendente"}
          </DialogTitle>
          <DialogDescription>
            {official && official.isActive ?
            "Ao desativar um atendente, ele não poderá mais acessar o sistema, mas seus dados serão mantidos para fins de histórico." :
            "Ao ativar um atendente, ele voltará a ter acesso ao sistema com suas mesmas permissões anteriores."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
            <div className="mr-3">
              <UserCog className="h-5 w-5 text-amber-600"/>
            </div>
            <div>
              <p className="font-medium">{official === null || official === void 0 ? void 0 : official.name}</p>
              <p className="text-sm text-neutral-500">{official === null || official === void 0 ? void 0 : official.email}</p>
            </div>
          </div>
          
          {official && official.departments && official.departments.length > 0 && (<div className="mb-4">
              <p className="text-sm font-medium mb-1">Departamentos:</p>
              <div className="flex flex-wrap gap-1">
                {official.departments.map(function (dept, index) {
                // Se dept é um objeto com propriedade 'department', pegamos essa propriedade
                // Se não, assumimos que dept é uma string diretamente
                var departmentValue = typeof dept === 'object' && dept !== null && 'department' in dept
                    ? dept.department
                    : dept;
                return (<Badge key={index} variant="outline" className="capitalize">
                      {departmentValue === 'technical' && 'Suporte Técnico'}
                      {departmentValue === 'billing' && 'Faturamento'}
                      {departmentValue === 'general' && 'Atendimento Geral'}
                      {departmentValue === 'sales' && 'Vendas'}
                      {departmentValue === 'other' && 'Outro'}
                    </Badge>);
            })}
              </div>
            </div>)}
          
          <p className="text-sm text-neutral-600 mb-6">
            {official && official.isActive ?
            "Esta ação não exclui o atendente permanentemente. Os dados serão mantidos para histórico e poderá ser reativado a qualquer momento." :
            "Ao ativar o atendente, ele poderá realizar login novamente no sistema e atender tickets."}
          </p>
        </div>
        
        <DialogFooter className="flex space-x-2 justify-end">
          <Button variant="outline" onClick={function () { return onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button onClick={handleToggleStatus} variant={official && official.isActive ? "destructive" : "default"} className={official && official.isActive ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"} disabled={processing}>
            {official && official.isActive ? (<>
                <UserX className="h-4 w-4 mr-2"/>
                {processing ? "Desativando..." : "Desativar"}
              </>) : (<>
                <UserCheck className="h-4 w-4 mr-2"/>
                {processing ? "Ativando..." : "Ativar"}
              </>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
