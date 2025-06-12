import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CheckCircle2, Sparkles, Bug, ArrowUp, Star } from "lucide-react";
import { useVersion } from "@/hooks/use-version";

// Função para obter ícone baseado no tipo de mudança
const getChangeIcon = (type: string) => {
  switch (type) {
    case 'new':
      return <Sparkles className="h-4 w-4 text-green-600" />;
    case 'improved':
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    case 'fixed':
      return <Bug className="h-4 w-4 text-orange-600" />;
    default:
      return <CheckCircle2 className="h-4 w-4 text-gray-600" />;
  }
};

// Função para obter cor do badge baseado no tipo de versão
const getBadgeVariant = (type: string) => {
  switch (type) {
    case 'major':
      return 'destructive';
    case 'feature':
      return 'default';
    case 'update':
      return 'secondary';
    case 'bugfix':
      return 'outline';
    case 'improvement':
      return 'outline';
    default:
      return 'secondary';
  }
};

// Função para formatar data (corrigindo timezone)
const formatDate = (dateString: string) => {
  // Adicionar um horário para evitar problemas de timezone
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default function Changelog() {
  const { versionData, isLoading, error } = useVersion();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Star className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-neutral-900">Histórico de Versões</h1>
          </div>
          <p className="text-lg text-neutral-600">
            Acompanhe todas as novidades, melhorias e correções do sistema
          </p>
        </div>
        
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Star className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-neutral-900">Histórico de Versões</h1>
          </div>
          <p className="text-lg text-neutral-600">
            Acompanhe todas as novidades, melhorias e correções do sistema
          </p>
        </div>
        
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 font-medium mb-2">Erro ao carregar dados de versão</p>
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!versionData || !versionData.versions) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Star className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-neutral-900">Histórico de Versões</h1>
          </div>
          <p className="text-lg text-neutral-600">
            Acompanhe todas as novidades, melhorias e correções do sistema
          </p>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-neutral-600">Nenhum dado de versão disponível</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const versions = versionData.versions;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Star className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-neutral-900">Histórico de Versões</h1>
        </div>
        <p className="text-lg text-neutral-600">
          Acompanhe todas as novidades, melhorias e correções do sistema
        </p>
      </div>

      <div className="space-y-6">
        {versions.map((version, index) => (
          <Card key={version.version} className={index === 0 ? 'border-primary/50 bg-primary/5' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">v{version.version}</CardTitle>
                  <Badge variant={getBadgeVariant(version.type)}>
                    {version.type === 'major' && 'Major'}
                    {version.type === 'feature' && 'Feature'}
                    {version.type === 'update' && 'Update'}
                    {version.type === 'bugfix' && 'Bugfix'}
                    {version.type === 'improvement' && 'Improvement'}
                  </Badge>
                  {index === 0 && (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                      Atual
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Calendar className="h-4 w-4" />
                  {formatDate(version.date)}
                </div>
              </div>
              <CardDescription className="text-base font-medium text-neutral-700">
                {version.title}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {version.changes.new && version.changes.new.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {getChangeIcon('new')}
                      <h4 className="font-semibold text-green-700">Novidades</h4>
                    </div>
                    <ul className="space-y-1 pl-6">
                      {version.changes.new.map((item, idx) => (
                        <li key={idx} className="text-neutral-600 flex items-start gap-2">
                          <span className="text-green-600 font-bold text-xs mt-1.5">●</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {version.changes.improved && version.changes.improved.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {getChangeIcon('improved')}
                      <h4 className="font-semibold text-blue-700">Melhorias</h4>
                    </div>
                    <ul className="space-y-1 pl-6">
                      {version.changes.improved.map((item, idx) => (
                        <li key={idx} className="text-neutral-600 flex items-start gap-2">
                          <span className="text-blue-600 font-bold text-xs mt-1.5">●</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {version.changes.fixed && version.changes.fixed.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {getChangeIcon('fixed')}
                      <h4 className="font-semibold text-orange-700">Correções</h4>
                    </div>
                    <ul className="space-y-1 pl-6">
                      {version.changes.fixed.map((item, idx) => (
                        <li key={idx} className="text-neutral-600 flex items-start gap-2">
                          <span className="text-orange-600 font-bold text-xs mt-1.5">●</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Card className="bg-neutral-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-neutral-700">Sistema em Desenvolvimento Ativo</span>
            </div>
            <p className="text-sm text-neutral-600">
              Novas funcionalidades e melhorias são lançadas regularmente.<br />
              Acompanhe esta página para ficar por dentro das novidades!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 