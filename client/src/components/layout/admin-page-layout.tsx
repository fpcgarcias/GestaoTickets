import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { CreateButton, SearchButton, FilterButton } from '@/components/ui/standardized-button';

interface AdminPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  onCreateClick?: () => void;
  createButtonText?: string;
  showCreateButton?: boolean;
  className?: string;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchClick?: () => void;
  onFilterClick?: () => void;
  showSearch?: boolean;
  showFilter?: boolean;
  children?: React.ReactNode;
  className?: string;
}

interface ContentCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

interface StatusBadgeProps {
  isActive: boolean;
  activeText?: string;
  inactiveText?: string;
  className?: string;
}

// Layout principal
export const AdminPageLayout: React.FC<AdminPageLayoutProps> = ({
  children,
  className,
}) => {
  return (
    <div className={cn('space-y-6 p-6', className)}>
      {children}
    </div>
  );
};

// Cabeçalho da página
export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  title,
  description,
  onCreateClick,
  createButtonText = 'Adicionar',
  showCreateButton = true,
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Linha principal com ícone, título e botão */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        
        {showCreateButton && onCreateClick && (
          <CreateButton 
            onClick={onCreateClick}
            text={createButtonText}
            size="default"
          />
        )}
      </div>
    </div>
  );
};

// Barra de filtros e busca
export const FilterBar: React.FC<FilterBarProps> = ({
  searchPlaceholder = 'Buscar...',
  searchValue,
  onSearchChange,
  onSearchClick,
  onFilterClick,
  showSearch = true,
  showFilter = true,
  children,
  className,
}) => {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex gap-4 items-center">
          {showSearch && (
            <div className="flex-1 flex gap-2">
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="max-w-sm"
              />
              {onSearchClick && (
                <SearchButton onClick={onSearchClick} />
              )}
            </div>
          )}
          
          {showFilter && onFilterClick && (
            <FilterButton onClick={onFilterClick} />
          )}
          
          {children}
        </div>
      </CardContent>
    </Card>
  );
};

// Card de conteúdo
export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  description,
  children,
  className,
}) => {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
      )}
      <CardContent className={!title && !description ? 'p-6' : ''}>
        {children}
      </CardContent>
    </Card>
  );
};

// Estado vazio
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center py-12 px-4',
      className
    )}>
      <div className="p-4 rounded-full bg-muted/50 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        {description}
      </p>
      {actionLabel && onAction && (
        <CreateButton 
          onClick={onAction}
          text={actionLabel}
        />
      )}
    </div>
  );
};

// Badge de status
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  isActive,
  activeText = 'Ativo',
  inactiveText = 'Inativo',
  className,
}) => {
  return (
    <Badge 
      variant={isActive ? 'default' : 'secondary'}
      className={cn(
        isActive 
          ? 'bg-green-100 text-green-800 hover:bg-green-100'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-100',
        className
      )}
    >
      {isActive ? activeText : inactiveText}
    </Badge>
  );
};

// Loading state para skeleton
export const LoadingSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('animate-pulse', className)}>
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gray-200 rounded-lg" />
            <div className="space-y-2">
              <div className="h-6 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-48 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-10 w-24 bg-gray-200 rounded" />
        </div>
        
        {/* Filter bar skeleton */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="h-10 w-64 bg-gray-200 rounded" />
              <div className="h-10 w-20 bg-gray-200 rounded" />
              <div className="h-10 w-20 bg-gray-200 rounded" />
            </div>
          </CardContent>
        </Card>
        
        {/* Content skeleton */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center space-x-4">
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                    <div className="space-y-1">
                      <div className="h-4 w-32 bg-gray-200 rounded" />
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Composição de exemplo de uma página completa
interface StandardPageProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  createButtonText?: string;
  searchPlaceholder?: string;
  onCreateClick?: () => void;
  onSearchChange?: (value: string) => void;
  onFilterClick?: () => void;
  searchValue?: string;
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const StandardPage: React.FC<StandardPageProps> = ({
  icon,
  title,
  description,
  createButtonText,
  searchPlaceholder,
  onCreateClick,
  onSearchChange,
  onFilterClick,
  searchValue,
  isLoading = false,
  children,
  className,
}) => {
  if (isLoading) {
    return (
      <AdminPageLayout className={className}>
        <LoadingSkeleton />
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout className={className}>
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        onCreateClick={onCreateClick}
        createButtonText={createButtonText}
        showCreateButton={!!onCreateClick}
      />
      
      <FilterBar
        searchPlaceholder={searchPlaceholder}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onFilterClick={onFilterClick}
        showSearch={!!onSearchChange}
        showFilter={!!onFilterClick}
      />
      
      <ContentCard>
        {children}
      </ContentCard>
    </AdminPageLayout>
  );
};

export default AdminPageLayout; 