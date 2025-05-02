import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";

export default function Settings() {
  return (
    <div>
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
                  <Input id="company-name" defaultValue="Ticket Lead" />
                </div>
                <div>
                  <Label htmlFor="support-email">Email de Suporte</Label>
                  <Input id="support-email" defaultValue="suporte@ticketlead.exemplo" type="email" />
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <h3 className="font-medium">Permitir Registro de Clientes</h3>
                  <p className="text-sm text-neutral-500">Permitir que clientes se registrem e criem suas próprias contas</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex justify-end">
                <Button>Salvar Configurações</Button>
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
                    <Input id="low-priority" type="number" defaultValue="48" />
                  </div>
                  <div>
                    <Label htmlFor="medium-priority">SLA Prioridade Média (horas)</Label>
                    <Input id="medium-priority" type="number" defaultValue="24" />
                  </div>
                  <div>
                    <Label htmlFor="high-priority">SLA Prioridade Alta (horas)</Label>
                    <Input id="high-priority" type="number" defaultValue="8" />
                  </div>
                  <div>
                    <Label htmlFor="critical-priority">SLA Prioridade Crítica (horas)</Label>
                    <Input id="critical-priority" type="number" defaultValue="4" />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <h3 className="font-medium">Notificações de Violação de SLA</h3>
                  <p className="text-sm text-neutral-500">Enviar alertas quando os prazos de SLA estiverem prestes a ser violados</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex justify-end">
                <Button>Salvar Configurações de SLA</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Departamentos</CardTitle>
              <CardDescription>Configure e gerencie departamentos de suporte</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <h3 className="font-medium">Suporte Técnico</h3>
                    <p className="text-sm text-neutral-500">Para problemas técnicos e de produto</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Editar</Button>
                    <Button variant="destructive" size="sm">Excluir</Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <h3 className="font-medium">Faturamento</h3>
                    <p className="text-sm text-neutral-500">Para consultas de pagamento e faturamento</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Editar</Button>
                    <Button variant="destructive" size="sm">Excluir</Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <h3 className="font-medium">Atendimento ao Cliente</h3>
                    <p className="text-sm text-neutral-500">Para consultas gerais e assistência</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Editar</Button>
                    <Button variant="destructive" size="sm">Excluir</Button>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Departamento
                </Button>
              </div>
            </CardContent>
          </Card>
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
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Respostas</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando os chamados recebem respostas</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Mudança de Status</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando o status do chamado muda</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Atribuição</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando chamados são atribuídos</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button>Salvar Configurações de Notificação</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
