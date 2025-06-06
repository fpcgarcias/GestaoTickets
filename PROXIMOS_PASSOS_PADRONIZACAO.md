# 📋 Próximos Passos - Padronização das Páginas Restantes

## ✅ **Páginas Já Implementadas:**
1. **Usuários** - `client/src/pages/users/index.tsx` ✅
2. **Clientes** - `client/src/pages/clients/index.tsx` ✅ 
3. **Permissões** - `client/src/pages/permissions.tsx` ✅

## 🔄 **Páginas Pendentes de Implementação:**

### **4. Departamentos** - `client/src/pages/DepartmentManagement.tsx`
**Status:** 🔄 Em Progresso
**Tarefas:**
- [ ] Implementar `StandardPage` layout
- [ ] Substituir botões por `ActionButtonGroup`
- [ ] Implementar `StatusBadge` padronizado
- [ ] Adicionar `EmptyState` para estados vazios
- [ ] Integrar busca padronizada
- [ ] Melhorar `Dialog` de formulário com componentes padronizados

### **5. Tipos de Chamados** - `client/src/pages/TicketTypeManagement.tsx`
**Status:** 🔄 Pendente
**Tarefas:**
- [ ] Implementar `StandardPage` layout
- [ ] Substituir botões por `ActionButtonGroup`
- [ ] Implementar `StatusBadge` padronizado
- [ ] Adicionar `EmptyState` para estados vazios
- [ ] Integrar busca padronizada
- [ ] Padronizar cores e espaçamentos

### **6. Empresas** - `client/src/pages/companies/`
**Status:** 🔄 Pendente
**Localização:** Verificar se existe em `client/src/pages/companies/index.tsx`
**Tarefas:**
- [ ] Localizar arquivo correto
- [ ] Implementar `StandardPage` layout
- [ ] Substituir botões por `ActionButtonGroup`
- [ ] Implementar `StatusBadge` padronizado
- [ ] Adicionar `EmptyState` para estados vazios
- [ ] Integrar busca padronizada

### **7. Atendentes/Officials** 
**Status:** 🔄 Pendente
**Localização:** Verificar se existe página específica para atendentes
**Tarefas:**
- [ ] Localizar arquivos relacionados a atendentes/officials
- [ ] Implementar padronização se página existir
- [ ] Caso não exista, verificar se é parte de outra página

## 🎨 **Componentes Padronizados Disponíveis:**

### **Layout:**
- `StandardPage` - Layout principal padronizado
- `EmptyState` - Estados vazios padronizados
- `StatusBadge` - Badges de status consistentes

### **Botões:**
- `ActionButtonGroup` - Grupo de ações (ver, editar, excluir)
- `SaveButton` - Botão de salvar padronizado
- `CancelButton` - Botão de cancelar padronizado
- `CreateButton` - Botão de criar padronizado
- `EditButton` - Botão de editar padronizado
- `DeleteButton` - Botão de excluir padronizado

### **Cores Padronizadas:**
```css
--primary: #2563eb;
--success: #059669;
--warning: #d97706;
--destructive: #dc2626;
--muted-foreground: hsl(215.4 16.3% 46.9%);
```

## 📝 **Processo de Implementação Recomendado:**

### **Para cada página:**

1. **Análise Inicial:**
   ```bash
   # Ler estrutura atual da página
   # Identificar componentes existentes
   # Mapear funcionalidades atuais
   ```

2. **Refatoração do Layout:**
   ```tsx
   // Substituir div principal por StandardPage
   <StandardPage
     icon={IconeApropriado}
     title="Título da Página"
     description="Descrição da funcionalidade"
     createButtonText="Texto do Botão"
     onCreateClick={handleCreate}
     onSearchChange={handleSearchChange}
     searchValue={searchValue}
     searchPlaceholder="Placeholder da busca..."
     isLoading={isLoading}
   >
   ```

3. **Implementação de Estados:**
   ```tsx
   // Estados vazios
   {items.length === 0 && (
     <EmptyState
       icon={Icone}
       title="Título"
       description="Descrição"
       actionLabel="Ação"
       onAction={handleAction}
     />
   )}
   ```

4. **Padronização de Botões:**
   ```tsx
   // Substituir botões individuais por grupo
   <ActionButtonGroup
     onView={() => handleView(item)}
     onEdit={() => handleEdit(item)}
     onDelete={() => handleDelete(item)}
   />
   ```

5. **Status Badges:**
   ```tsx
   // Substituir badges customizados
   <StatusBadge isActive={item.active} />
   ```

## 🚀 **Comando para Continuar:**

```bash
# Para continuar a implementação da próxima página:
/ui continue implementando a padronização na página de departamentos
```

## 🎯 **Benefícios Esperados:**

- **Consistência Visual:** Todas as páginas seguindo o mesmo padrão
- **Manutenibilidade:** Componentes reutilizáveis facilitam alterações
- **UX Melhorada:** Interface mais previsível e intuitiva
- **Acessibilidade:** Componentes padronizados com melhor suporte
- **Performance:** Componentes otimizados e reutilizáveis

## 📊 **Progresso Atual:**
- **Concluídas:** 3/7 páginas (43%)
- **Em Progresso:** 1 página
- **Pendentes:** 3 páginas 