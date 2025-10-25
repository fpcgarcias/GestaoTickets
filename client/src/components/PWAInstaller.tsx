import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, RefreshCw, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstaller: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    // Detectar se o app já está instalado
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
      }
    };

    checkIfInstalled();

    // Listener para o evento beforeinstallprompt - DEIXAR O NAVEGADOR FAZER O TRABALHO
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🎯 Evento beforeinstallprompt disparado!');
      // NÃO FAZER NADA - DEIXAR O NAVEGADOR MOSTRAR O PROMPT NATIVO
    };

    // Listener para quando o app é instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA instalado com sucesso');
    } else {
      console.log('Instalação do PWA cancelada');
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleUpdateClick = () => {
    window.location.reload();
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
  };

  const handleDismissUpdate = () => {
    setNeedRefresh(false);
  };

  // NÃO MOSTRAR NADA - DEIXAR O NAVEGADOR FAZER O TRABALHO
  return null;
};
