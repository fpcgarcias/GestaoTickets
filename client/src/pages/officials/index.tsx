import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  Mail, 
  Pencil, 
  Trash, 
  UserPlus,
  Check,
  X,
  UserCog,
  UserCheck,
  UserX,
  Shield,
  User,
  AlertTriangle,
  Building2,
  Users
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { AddOfficialDialog } from './add-official-dialog';
import { EditOfficialDialog } from './edit-official-dialog';
import { ToggleStatusOfficialDialog } from '@/pages/officials/toggle-status-official-dialog';
import { Official } from '@shared/schema';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

// Novos imports padronizados
import { StandardPage, StatusBadge, EmptyState } from '@/components/layout/admin-page-layout';
import { ActionButtonGroup, SaveButton, CancelButton } from '@/components/ui/standardized-button';

// Estendendo a interface Official para incluir o user com username
interface OfficialWithUser extends Official {
  user?: {
    id: number;
    username: string;
    email?: string;
  };
}

export default function OfficialsIndex() {
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialWithUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: officials = [], isLoading, error } = useQuery<OfficialWithUser[]>({
    queryKey: ['/api/officials'],
    staleTime: 0, // Forçar recarregamento
  });
  
  console.log('[DEBUG Frontend] Officials recebidos:', officials);
  
  const queryClient = useQueryClient();

  // Handlers padronizados
  const handleCreateOfficial = () => {
    setShowAddDialog(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };
  
  const handleEditOfficial = (official: OfficialWithUser) => {
    setSelectedOfficial(official);
    setShowEditDialog(true);
  };
  
  const handleDeleteOfficial = (official: OfficialWithUser) => {
    setSelectedOfficial(official);
    setShowDeleteDialog(true);
  };
  
  // Função para obter o username do atendente de qualquer estrutura possível
  const getUsernameFromOfficial = (official: any): string => {
    // Caso 1: o usuário está na propriedade 'user'
    if (official.user && official.user.username) {
      return official.user.username;
    }
    
    // Caso 2: username está diretamente no atendente
    if (official.username) {
      return official.username;
    }
    
    // Caso 3: pode estar em outra estrutura como user_id: {username: ...}
    if (official.user_id && typeof official.user_id === 'object' && (official.user_id as any).username) {
      return (official.user_id as any).username;
    }
    
    // Caso 4: pode estar em userData
    if (official.userData && official.userData.username) {
      return official.userData.username;
    }
    
    // Caso 5: fallback para email se nenhum username for encontrado
    return official.email || '-';
  };
  
  // Filtrar os atendentes com base na busca
  const filteredOfficials = officials?.filter(official => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const username = getUsernameFromOfficial(official);
    
    return (
      official.name.toLowerCase().includes(query) ||
      official.email.toLowerCase().includes(query) ||
      (username && username.toLowerCase().includes(query))
    );
  });

  // Estado de erro
  if (error) {
    return (
      <StandardPage
        icon={Users}
        title="Atendentes"
        description="Gerencie os membros da equipe de suporte"
        createButtonText="Adicionar Atendente"
        onCreateClick={handleCreateOfficial}
        onSearchChange={handleSearchChange}
        searchValue={searchQuery}
        searchPlaceholder="Pesquisar atendentes..."
      >
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-muted-foreground mb-4 text-center">
            {error instanceof Error ? error.message : 'Ocorreu um erro inesperado'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </StandardPage>
    );
  }

  // Estado vazio quando não há atendentes
  if (filteredOfficials && filteredOfficials.length === 0 && !isLoading && !searchQuery) {
    return (
      <>
        <StandardPage
          icon={Users}
          title="Atendentes"
          description="Gerencie os membros da sua equipe de suporte"
          createButtonText="Adicionar Atendente"
          onCreateClick={handleCreateOfficial}
          onSearchChange={handleSearchChange}
          searchValue={searchQuery}
          searchPlaceholder="Pesquisar atendentes..."
        >
          <EmptyState
            icon={Users}
            title="Nenhum atendente encontrado"
            description="Não há atendentes cadastrados no sistema. Clique no botão abaixo para adicionar o primeiro membro da equipe."
            actionLabel="Adicionar Primeiro Atendente"
            onAction={handleCreateOfficial}
          />
        </StandardPage>

        {/* Dialogs mantidos */}
        {renderDialogs()}
      </>
    );
  }

  // Função para renderizar os dialogs
  function renderDialogs() {
    return (
      <>
        <AddOfficialDialog 
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onCreated={(official) => {
            // Atualizar a lista de atendentes automaticamente depois que um novo for adicionado
            queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
          }}
        />
        
        <EditOfficialDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          official={selectedOfficial}
          onSaved={() => {
            // Atualizar a lista após edição
            queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
          }}
        />
        
        <ToggleStatusOfficialDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          official={selectedOfficial}
          onStatusChanged={() => {
            // Atualizar a lista após alteração de status
            queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
          }}
        />
      </>
    );
  }

  return (
    <>
      <StandardPage
        icon={Users}
        title="Atendentes"
        description="Gerencie os membros da sua equipe de suporte"
        createButtonText="Adicionar Atendente"
        onCreateClick={handleCreateOfficial}
        onSearchChange={handleSearchChange}
        searchValue={searchQuery}
        searchPlaceholder="Pesquisar atendentes..."
        isLoading={isLoading}
      >
        {/* Contador de resultados */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {filteredOfficials ? `${filteredOfficials.length} atendente(s) encontrado(s)` : ''}
          </div>
        </div>

        {filteredOfficials && filteredOfficials.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhum atendente encontrado"
            description={`Não foram encontrados atendentes com o termo "${searchQuery}".`}
            actionLabel="Limpar busca"
            onAction={() => setSearchQuery('')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Manager</TableHead>
                {user?.role === 'admin' && <TableHead>Empresa</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Tickets Atribuídos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                filteredOfficials.map((official) => {
                  const username = getUsernameFromOfficial(official);
                  console.log('Official data:', official);
                  
                  // Adicionar logs específicos para debugar a estrutura do user
                  if (official.user) {
                    console.log('User data encontrado:', official.user);
                    console.log('Username do usuário:', official.user.username);
                  } else {
                    console.log('Oficial sem propriedade user:', official);
                    console.log('UserId value:', official.user_id);
                  }
                  
                  return (
                    <TableRow key={official.id}>
                      <TableCell className="font-medium">{official.name}</TableCell>
                      <TableCell>{username}</TableCell>
                      <TableCell>{official.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {official.departments && Array.isArray(official.departments) && official.departments.length > 0 ? (
                            // Exibir os departamentos
                            official.departments.map((dept, index) => {
                              // Se dept é um objeto com propriedade 'department', pegamos essa propriedade
                              // Se não, assumimos que dept é uma string diretamente
                              const departmentValue = typeof dept === 'object' && dept !== null && 'department' in dept
                                ? dept.department
                                : dept;
                                
                              return (
                                <Badge key={index} variant="outline" className="capitalize">
                                  {departmentValue}
                                </Badge>
                              );
                            })
                          ) : (
                            <span className="text-muted-foreground text-sm">Sem departamento</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* Mostrar supervisor */}
                        {(official as any).supervisor_id ? (
                          <span className="text-sm text-muted-foreground">
                            {/* Buscar nome do supervisor nos dados */}
                            {officials.find(o => o.id === (official as any).supervisor_id)?.name || `ID: ${(official as any).supervisor_id}`}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* Mostrar manager */}
                        {(official as any).manager_id ? (
                          <span className="text-sm text-muted-foreground">
                            {/* Buscar nome do manager nos dados */}
                            {officials.find(o => o.id === (official as any).manager_id)?.name || `ID: ${(official as any).manager_id}`}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {user?.role === 'admin' && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {(official as any).company?.name || 'Sistema Global'}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <StatusBadge isActive={official.is_active} />
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const count = (official as any).assignedTicketsCount;
                          if (typeof count === 'number') return count;
                          if (typeof count === 'string' && !isNaN(Number(count))) return Number(count);
                          return '—';
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionButtonGroup
                          onEdit={() => handleEditOfficial(official)}
                          onDelete={() => handleDeleteOfficial(official)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </StandardPage>

      {renderDialogs()}
    </>
  );
}
