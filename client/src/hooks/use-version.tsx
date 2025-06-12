import { useState, useEffect } from 'react';

interface VersionChange {
  new?: string[];
  improved?: string[];
  fixed?: string[];
}

interface Version {
  version: string;
  date: string;
  title: string;
  type: string;
  changes: VersionChange;
}

interface VersionData {
  current: string;
  releaseDate: string;
  versions: Version[];
  metadata: {
    name: string;
    codename: string;
    environment: string;
    lastUpdate: string;
  };
}

interface UseVersionReturn {
  versionData: VersionData | null;
  currentVersion: string;
  isLoading: boolean;
  error: string | null;
}

export const useVersion = (): UseVersionReturn => {
  const [versionData, setVersionData] = useState<VersionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVersionData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Carrega o arquivo version.json do diretório raiz do projeto
        const response = await fetch('/version.json');
        
        if (!response.ok) {
          throw new Error(`Erro ao carregar version.json: ${response.status}`);
        }
        
        const data: VersionData = await response.json();
        setVersionData(data);
      } catch (err) {
        console.error('Erro ao carregar dados de versão:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        
        // Fallback com dados básicos em caso de erro
        setVersionData({
          current: '1.0.14',
          releaseDate: '2025-06-12',
          versions: [{
            version: '1.0.14',
            date: '2025-06-12',
            title: 'Versão Atual',
            type: 'update',
            changes: {
              new: ['Sistema funcionando normalmente']
            }
          }],
          metadata: {
            name: 'Sistema de Gestão de Chamados',
            codename: 'Ticket Wise',
            environment: 'production',
            lastUpdate: new Date().toISOString()
          }
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadVersionData();
  }, []);

  return {
    versionData,
    currentVersion: versionData?.current || '1.0.14',
    isLoading,
    error
  };
}; 