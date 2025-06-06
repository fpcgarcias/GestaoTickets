import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon, 
  Search,
  Filter,
  Save,
  X,
  LoaderIcon 
} from 'lucide-react';

// Tipos de ações padronizadas
export type ActionType = 
  | 'create' 
  | 'edit' 
  | 'delete' 
  | 'view' 
  | 'search' 
  | 'filter' 
  | 'save' 
  | 'cancel'
  | 'custom';

interface StandardizedButtonProps extends Omit<ButtonProps, 'children'> {
  action?: ActionType;
  children?: React.ReactNode;
  loading?: boolean;
  iconOnly?: boolean;
  text?: string;
}

// Configurações para cada tipo de ação
const actionConfigs = {
  create: {
    icon: PlusIcon,
    text: 'Adicionar',
    variant: 'default' as const,
    className: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  },
  edit: {
    icon: PencilIcon,
    text: 'Editar',
    variant: 'ghost' as const,
    className: 'hover:bg-blue-50 hover:text-blue-600',
  },
  delete: {
    icon: TrashIcon,
    text: 'Excluir',
    variant: 'destructive' as const,
    className: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
  },
  view: {
    icon: EyeIcon,
    text: 'Visualizar',
    variant: 'secondary' as const,
    className: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground',
  },
  search: {
    icon: Search,
    text: 'Buscar',
    variant: 'outline' as const,
    className: 'border-input hover:bg-accent hover:text-accent-foreground',
  },
  filter: {
    icon: Filter,
    text: 'Filtros',
    variant: 'ghost' as const,
    className: 'hover:bg-accent hover:text-accent-foreground',
  },
  save: {
    icon: Save,
    text: 'Salvar',
    variant: 'default' as const,
    className: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  },
  cancel: {
    icon: X,
    text: 'Cancelar',
    variant: 'outline' as const,
    className: 'border-input hover:bg-accent hover:text-accent-foreground',
  },
  custom: {
    icon: null,
    text: '',
    variant: 'default' as const,
    className: '',
  },
};

export const StandardizedButton: React.FC<StandardizedButtonProps> = ({
  action = 'custom',
  children,
  loading = false,
  iconOnly = false,
  text,
  className,
  size = 'default',
  variant,
  disabled,
  ...props
}) => {
  const config = actionConfigs[action];
  const IconComponent = config.icon;
  
  // Determinar o texto a ser exibido
  const displayText = text || config.text;
  
  // Determinar a variante (props tem prioridade sobre config)
  const buttonVariant = variant || config.variant;
  
  // Determinar se está desabilitado
  const isDisabled = disabled || loading;

  return (
    <Button
      variant={buttonVariant}
      size={size}
      disabled={isDisabled}
      className={cn(
        'transition-all duration-200',
        config.className,
        loading && 'cursor-wait',
        className
      )}
      {...props}
    >
      {loading ? (
        <LoaderIcon className="h-4 w-4 animate-spin" />
      ) : (
        IconComponent && <IconComponent className="h-4 w-4" />
      )}
      
      {!iconOnly && (
        <>
          {(IconComponent || loading) && !iconOnly && (
            <span className="ml-2">{displayText}</span>
          )}
          {!IconComponent && !loading && displayText}
        </>
      )}
      
      {children}
    </Button>
  );
};

// Componentes específicos para ações comuns
export const CreateButton: React.FC<Omit<StandardizedButtonProps, 'action'>> = (props) => (
  <StandardizedButton action="create" {...props} />
);

export const EditButton: React.FC<Omit<StandardizedButtonProps, 'action'>> = (props) => (
  <StandardizedButton action="edit" size="sm" {...props} />
);

export const DeleteButton: React.FC<Omit<StandardizedButtonProps, 'action'>> = (props) => (
  <StandardizedButton action="delete" size="sm" {...props} />
);

export const ViewButton: React.FC<Omit<StandardizedButtonProps, 'action'>> = (props) => (
  <StandardizedButton action="view" size="sm" {...props} />
);

export const SearchButton: React.FC<Omit<StandardizedButtonProps, 'action'>> = (props) => (
  <StandardizedButton action="search" {...props} />
);

export const FilterButton: React.FC<Omit<StandardizedButtonProps, 'action'>> = (props) => (
  <StandardizedButton action="filter" {...props} />
);

export const SaveButton: React.FC<Omit<StandardizedButtonProps, 'action'>> = (props) => (
  <StandardizedButton action="save" {...props} />
);

export const CancelButton: React.FC<Omit<StandardizedButtonProps, 'action'>> = (props) => (
  <StandardizedButton action="cancel" {...props} />
);

// Grupo de botões de ação para tabelas
interface ActionButtonGroupProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showView?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  loading?: boolean;
  className?: string;
}

export const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({
  onView,
  onEdit,
  onDelete,
  showView = true,
  showEdit = true,
  showDelete = true,
  loading = false,
  className,
}) => {
  return (
    <div className={cn('flex gap-1', className)}>
      {showView && onView && (
        <ViewButton 
          iconOnly 
          onClick={onView} 
          disabled={loading}
          className="h-8 w-8"
        />
      )}
      {showEdit && onEdit && (
        <EditButton 
          iconOnly 
          onClick={onEdit} 
          disabled={loading}
          className="h-8 w-8"
        />
      )}
      {showDelete && onDelete && (
        <DeleteButton 
          iconOnly 
          onClick={onDelete} 
          disabled={loading}
          className="h-8 w-8"
        />
      )}
    </div>
  );
};

export default StandardizedButton; 