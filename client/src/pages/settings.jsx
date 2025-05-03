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
import React, { useState } from 'react';
import { DepartmentsSettings } from '@/components/settings/departments-settings';
import { IncidentTypesSettings } from '@/components/settings/incident-types-settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
export default function Settings() {
    var _this = this;
    var toast = useToast().toast;
    // Carregar configurações de SLA
    var _a = useQuery({
        queryKey: ["/api/settings/sla"],
    }), slaSettingsData = _a.data, isLoadingSla = _a.isLoading;
    // Carregar configurações gerais
    var _b = useQuery({
        queryKey: ["/api/settings/general"],
    }), generalSettingsData = _b.data, isLoadingGeneral = _b.isLoading;
    // Estados para formulário de SLA
    var _c = useState(""), lowPriority = _c[0], setLowPriority = _c[1];
    var _d = useState(""), mediumPriority = _d[0], setMediumPriority = _d[1];
    var _e = useState(""), highPriority = _e[0], setHighPriority = _e[1];
    var _f = useState(""), criticalPriority = _f[0], setCriticalPriority = _f[1];
    var _g = useState(true), slaNotifications = _g[0], setSlaNotifications = _g[1];
    // Estados para formulário geral
    var _h = useState(""), companyName = _h[0], setCompanyName = _h[1];
    var _j = useState(""), supportEmail = _j[0], setSupportEmail = _j[1];
    var _k = useState(true), allowCustomerRegistration = _k[0], setAllowCustomerRegistration = _k[1];
    // Garantir que os dados sejam tratados corretamente
    var slaSettings = Array.isArray(slaSettingsData) ? slaSettingsData : [];
    var generalSettings = generalSettingsData || { companyName: '', supportEmail: '', allowCustomerRegistration: true };
    // Atualizar estados quando os dados são carregados
    React.useEffect(function () {
        if (slaSettings.length > 0) { // Usar slaSettings que é array
            var low = slaSettings.find(function (s) { return s.priority === 'low'; });
            var medium = slaSettings.find(function (s) { return s.priority === 'medium'; });
            var high = slaSettings.find(function (s) { return s.priority === 'high'; });
            var critical = slaSettings.find(function (s) { return s.priority === 'critical'; });
            if (low)
                setLowPriority(low.resolutionTimeHours.toString());
            if (medium)
                setMediumPriority(medium.resolutionTimeHours.toString());
            if (high)
                setHighPriority(high.resolutionTimeHours.toString());
            if (critical)
                setCriticalPriority(critical.resolutionTimeHours.toString());
        }
    }, [slaSettings]); // Depender de slaSettings
    React.useEffect(function () {
        // Usar generalSettings que tem valor padrão
        setCompanyName(generalSettings.companyName || "");
        setSupportEmail(generalSettings.supportEmail || "");
        setAllowCustomerRegistration(generalSettings.allowCustomerRegistration || true);
    }, [generalSettings]); // Depender de generalSettings
    // Mutação para salvar configurações de SLA
    var saveSlaSettingsMutation = useMutation({
        mutationFn: function (data) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest("POST", "/api/settings/sla", data)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        onSuccess: function () {
            toast({
                title: "Configurações de SLA salvas",
                description: "As configurações de SLA foram atualizadas com sucesso",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/settings/sla"] });
        },
        onError: function (error) {
            toast({
                title: "Erro ao salvar configurações",
                description: error.message,
                variant: "destructive",
            });
        },
    });
    // Mutação para salvar configurações gerais
    var saveGeneralSettingsMutation = useMutation({
        mutationFn: function (data) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest("POST", "/api/settings/general", data)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        onSuccess: function () {
            toast({
                title: "Configurações gerais salvas",
                description: "As configurações gerais foram atualizadas com sucesso",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/settings/general"] });
        },
        onError: function (error) {
            toast({
                title: "Erro ao salvar configurações",
                description: error.message,
                variant: "destructive",
            });
        },
    });
    // Handler para salvar configurações de SLA
    var handleSaveSlaSettings = function () { return __awaiter(_this, void 0, void 0, function () {
        var prioritySettings, _i, prioritySettings_1, setting, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    prioritySettings = [
                        { priority: 'low', responseTimeHours: 72, resolutionTimeHours: parseInt(lowPriority) || 120 },
                        { priority: 'medium', responseTimeHours: 48, resolutionTimeHours: parseInt(mediumPriority) || 72 },
                        { priority: 'high', responseTimeHours: 24, resolutionTimeHours: parseInt(highPriority) || 48 },
                        { priority: 'critical', responseTimeHours: 4, resolutionTimeHours: parseInt(criticalPriority) || 24 },
                    ];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    _i = 0, prioritySettings_1 = prioritySettings;
                    _a.label = 2;
                case 2:
                    if (!(_i < prioritySettings_1.length)) return [3 /*break*/, 5];
                    setting = prioritySettings_1[_i];
                    return [4 /*yield*/, saveSlaSettingsMutation.mutateAsync(setting)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    toast({
                        title: "Configurações de SLA salvas",
                        description: "Todas as configurações de SLA foram atualizadas com sucesso",
                    });
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    toast({
                        title: "Erro ao salvar configurações",
                        description: "Ocorreu um erro ao salvar as configurações de SLA",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    // Handler para salvar configurações gerais
    var handleSaveGeneralSettings = function () {
        saveGeneralSettingsMutation.mutate({
            companyName: companyName,
            supportEmail: supportEmail,
            allowCustomerRegistration: allowCustomerRegistration,
        });
    };
    return (<div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Configurações do Sistema</h1>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
          <TabsTrigger value="general" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Geral
          </TabsTrigger>
          <TabsTrigger value="sla" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Configurações de SLA
          </TabsTrigger>
          <TabsTrigger value="departments" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Departamentos
          </TabsTrigger>
          <TabsTrigger value="ticket-types" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Tipos de Chamado
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Notificações
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>Configure as configurações básicas para seu sistema de chamados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="company-name">Nome da Empresa</Label>
                  <Input id="company-name" value={companyName} onChange={function (e) { return setCompanyName(e.target.value); }}/>
                </div>
                <div>
                  <Label htmlFor="support-email">Email de Suporte</Label>
                  <Input id="support-email" value={supportEmail} onChange={function (e) { return setSupportEmail(e.target.value); }} type="email"/>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <h3 className="font-medium">Permitir Registro de Clientes</h3>
                  <p className="text-sm text-neutral-500">Permitir que clientes se registrem e criem suas próprias contas</p>
                </div>
                <Switch checked={allowCustomerRegistration} onCheckedChange={setAllowCustomerRegistration}/>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleSaveGeneralSettings} disabled={saveGeneralSettingsMutation.isPending}>
                  {saveGeneralSettingsMutation.isPending ? (<>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                      Salvando...
                    </>) : ('Salvar Configurações')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sla">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de SLA</CardTitle>
              <CardDescription>Configure requisitos de tempo de resposta por prioridade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="low-priority">SLA Prioridade Baixa (horas)</Label>
                    <Input id="low-priority" type="number" value={lowPriority} onChange={function (e) { return setLowPriority(e.target.value); }}/>
                  </div>
                  <div>
                    <Label htmlFor="medium-priority">SLA Prioridade Média (horas)</Label>
                    <Input id="medium-priority" type="number" value={mediumPriority} onChange={function (e) { return setMediumPriority(e.target.value); }}/>
                  </div>
                  <div>
                    <Label htmlFor="high-priority">SLA Prioridade Alta (horas)</Label>
                    <Input id="high-priority" type="number" value={highPriority} onChange={function (e) { return setHighPriority(e.target.value); }}/>
                  </div>
                  <div>
                    <Label htmlFor="critical-priority">SLA Prioridade Crítica (horas)</Label>
                    <Input id="critical-priority" type="number" value={criticalPriority} onChange={function (e) { return setCriticalPriority(e.target.value); }}/>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <h3 className="font-medium">Notificações de Violação de SLA</h3>
                  <p className="text-sm text-neutral-500">Enviar alertas quando os prazos de SLA estiverem prestes a ser violados</p>
                </div>
                <Switch checked={slaNotifications} onCheckedChange={setSlaNotifications}/>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleSaveSlaSettings} disabled={saveSlaSettingsMutation.isPending}>
                  {saveSlaSettingsMutation.isPending ? (<>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                      Salvando...
                    </>) : ('Salvar Configurações de SLA')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="departments">
          <DepartmentsSettings />
        </TabsContent>
        
        <TabsContent value="ticket-types">
          <IncidentTypesSettings />
        </TabsContent>
        
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificação</CardTitle>
              <CardDescription>Configure quando e como as notificações são enviadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Novos Chamados</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando novos chamados são criados</p>
                  </div>
                  <Switch defaultChecked/>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Respostas</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando os chamados recebem respostas</p>
                  </div>
                  <Switch defaultChecked/>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Mudança de Status</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando o status do chamado muda</p>
                  </div>
                  <Switch defaultChecked/>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Atribuição</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando chamados são atribuídos</p>
                  </div>
                  <Switch defaultChecked/>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={function () {
            toast({
                title: "Configurações de notificação salvas",
                description: "As configurações de notificação foram atualizadas com sucesso",
            });
        }}>
                  Salvar Configurações de Notificação
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);
}
