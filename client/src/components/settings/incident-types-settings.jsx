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
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export function IncidentTypesSettings() {
    var _this = this;
    var toast = useToast().toast;
    var _a = useState([]), incidentTypes = _a[0], setIncidentTypes = _a[1];
    var _b = useState(null), editingId = _b[0], setEditingId = _b[1];
    var _c = useState(false), isAdding = _c[0], setIsAdding = _c[1];
    // Formulário para novo tipo de incidente
    var _d = useState(''), newName = _d[0], setNewName = _d[1];
    var _f = useState(null), newDepartmentId = _f[0], setNewDepartmentId = _f[1];
    // Formulário para edição
    var _g = useState(''), editName = _g[0], setEditName = _g[1];
    var _j = useState(null), editDepartmentId = _j[0], setEditDepartmentId = _j[1];
    // Carregar tipos de incidentes e departamentos
    var _k = useQuery({
        queryKey: ["/api/settings/incident-types"],
    }), incidentTypesData = _k.data, isLoadingIncidentTypes = _k.isLoading;
    var _l = useQuery({
        queryKey: ["/api/settings/departments"],
    }), departmentsData = _l.data, isLoadingDepartments = _l.isLoading;
    // Atualizar estados quando os dados são carregados
    useEffect(function () {
        setIncidentTypes(Array.isArray(incidentTypesData) ? incidentTypesData : []);
    }, [incidentTypesData]);
    // Garante que departments é um array para uso posterior
    var departments = Array.isArray(departmentsData) ? departmentsData : [];
    // Mutação para salvar tipos de incidentes
    var saveIncidentTypesMutation = useMutation({
        mutationFn: function (updatedIncidentTypes) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest("POST", "/api/settings/incident-types", updatedIncidentTypes)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        onSuccess: function () {
            toast({
                title: "Tipos de chamado salvos",
                description: "Os tipos de chamado foram atualizados com sucesso",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/settings/incident-types"] });
            resetForm();
        },
        onError: function (error) {
            toast({
                title: "Erro ao salvar tipos de chamado",
                description: error.message,
                variant: "destructive",
            });
        },
    });
    var resetForm = function () {
        setIsAdding(false);
        setEditingId(null);
        setNewName('');
        setNewDepartmentId(null);
        setEditName('');
        setEditDepartmentId(null);
    };
    var startEdit = function (incidentType) {
        setEditingId(incidentType.id);
        setEditName(incidentType.name);
        setEditDepartmentId(incidentType.departmentId);
    };
    var cancelEdit = function () {
        setEditingId(null);
    };
    var saveEdit = function () {
        if (!editName.trim()) {
            toast({
                title: "Erro",
                description: "O nome do tipo de chamado é obrigatório",
                variant: "destructive",
            });
            return;
        }
        if (!editDepartmentId) {
            toast({
                title: "Erro",
                description: "É necessário selecionar um departamento",
                variant: "destructive",
            });
            return;
        }
        var updatedIncidentTypes = incidentTypes.map(function (type) {
            return type.id === editingId ? __assign(__assign({}, type), { name: editName, departmentId: editDepartmentId }) : type;
        });
        saveIncidentTypesMutation.mutate(updatedIncidentTypes);
    };
    var addIncidentType = function () {
        if (!newName.trim()) {
            toast({
                title: "Erro",
                description: "O nome do tipo de chamado é obrigatório",
                variant: "destructive",
            });
            return;
        }
        if (!newDepartmentId) {
            toast({
                title: "Erro",
                description: "É necessário selecionar um departamento",
                variant: "destructive",
            });
            return;
        }
        
        // Verificar se o nome já existe
        if (incidentTypes.some(function (type) { return type.name.toLowerCase() === newName.trim().toLowerCase() && type.departmentId === newDepartmentId; })) {
            toast({
                title: "Erro",
                description: "Já existe um tipo de chamado com este nome neste departamento.",
                variant: "destructive",
            });
            return;
        }
        
        var newId = incidentTypes.length > 0
            ? Math.max.apply(Math, incidentTypes.map(function (d) { return d.id; })) + 1
            : 1;
        var newIncidentType = {
            id: newId,
            name: newName,
            departmentId: newDepartmentId,
        };
        var updatedIncidentTypes = __spreadArray(__spreadArray([], incidentTypes, true), [newIncidentType], false);
        saveIncidentTypesMutation.mutate(updatedIncidentTypes);
    };
    var deleteIncidentType = function (id) {
        var updatedIncidentTypes = incidentTypes.filter(function (type) { return type.id !== id; });
        saveIncidentTypesMutation.mutate(updatedIncidentTypes);
    };
    if (isLoadingIncidentTypes || isLoadingDepartments) {
        return (<Card>
        <CardContent className="pt-6 flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary"/>
        </CardContent>
      </Card>);
    }
    var getDepartmentName = function (id) {
        var department = departments.find(function (dept) { return dept.id === id; });
        return department ? department.name : 'Departamento não encontrado';
    };
    return (<Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Tipos de Chamado</CardTitle>
        <CardDescription>Configure e gerencie os tipos de chamados disponíveis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {incidentTypes && incidentTypes.length > 0 ? (incidentTypes.map(function (type) {
            var _a;
            return (<div key={type.id} className="flex items-center justify-between p-3 border rounded-md">
                {editingId === type.id ? (<div className="flex-1 space-y-2">
                    <Label htmlFor={"edit-name-".concat(type.id)}>Nome do Tipo</Label>
                    <Input id={"edit-name-".concat(type.id)} value={editName} onChange={function (e) { return setEditName(e.target.value); }}/>
                    
                    <Label htmlFor={"edit-department-".concat(type.id)}>Departamento</Label>
                    <Select onValueChange={function (value) { return setEditDepartmentId(parseInt(value)); }} defaultValue={(_a = type.departmentId) === null || _a === void 0 ? void 0 : _a.toString()}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um departamento"/>
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(function (dept) { return (<SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>); })}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex gap-2 mt-2">
                      <Button onClick={saveEdit} variant="default" size="sm" disabled={saveIncidentTypesMutation.isPending}>
                        {saveIncidentTypesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                        Salvar
                      </Button>
                      <Button onClick={cancelEdit} variant="outline" size="sm">
                        <X className="h-4 w-4 mr-1"/>
                        Cancelar
                      </Button>
                    </div>
                  </div>) : (<>
                    <div>
                      <h3 className="font-medium">{type.name}</h3>
                      <p className="text-sm text-neutral-500">
                        Departamento: {getDepartmentName(type.departmentId)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={function () { return startEdit(type); }}>
                        <Pencil className="h-3.5 w-3.5 mr-1"/>
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={function () { return deleteIncidentType(type.id); }} disabled={saveIncidentTypesMutation.isPending}>
                        {saveIncidentTypesMutation.isPending ? (<Loader2 className="h-3.5 w-3.5 mr-1 animate-spin"/>) : (<Trash2 className="h-3.5 w-3.5 mr-1"/>)}
                        Excluir
                      </Button>
                    </div>
                  </>)}
              </div>);
        })) : (<div className="text-center py-8 text-muted-foreground">
              Nenhum tipo de chamado encontrado. Adicione seu primeiro tipo.
            </div>)}
        </div>
        
        {isAdding ? (<div className="border rounded-md p-4 space-y-4">
            <h3 className="font-medium">Novo Tipo de Chamado</h3>
            
            <div>
              <Label htmlFor="new-name">Nome do Tipo</Label>
              <Input id="new-name" value={newName} onChange={function (e) { return setNewName(e.target.value); }} placeholder="Ex: Problema Técnico"/>
            </div>
            
            <div>
              <Label htmlFor="new-department">Departamento</Label>
              <Select onValueChange={function (value) { return setNewDepartmentId(parseInt(value)); }} defaultValue={newDepartmentId === null || newDepartmentId === void 0 ? void 0 : newDepartmentId.toString()}>
                <SelectTrigger id="new-department">
                  <SelectValue placeholder="Selecione um departamento"/>
                </SelectTrigger>
                <SelectContent>
                  {departments.map(function (dept) { return (<SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>); })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={addIncidentType} disabled={saveIncidentTypesMutation.isPending}>
                {saveIncidentTypesMutation.isPending ? (<Loader2 className="mr-2 h-4 w-4 animate-spin"/>) : (<Plus className="mr-2 h-4 w-4"/>)}
                Adicionar
              </Button>
              <Button variant="outline" onClick={function () { return setIsAdding(false); }}>
                Cancelar
              </Button>
            </div>
          </div>) : (<div className="flex justify-end">
            <Button onClick={function () { return setIsAdding(true); }}>
              <Plus className="mr-2 h-4 w-4"/>
              Adicionar Tipo de Chamado
            </Button>
          </div>)}
      </CardContent>
    </Card>);
}
