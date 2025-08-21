import { useState, useEffect } from 'react';

/**
 * Hook para verificar se está no horário comercial (6h às 21h)
 * Atualiza automaticamente quando o horário muda
 */
export function useBusinessHours() {
  const [isWithinAllowedHours, setIsWithinAllowedHours] = useState(() => {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 6 && hour < 21;
  });

  useEffect(() => {
    const checkBusinessHours = () => {
      const now = new Date();
      const hour = now.getHours();
      const withinHours = hour >= 6 && hour < 21;
      setIsWithinAllowedHours(withinHours);
    };

    // Verificar a cada minuto
    const interval = setInterval(checkBusinessHours, 60000);
    
    // Verificar imediatamente
    checkBusinessHours();

    return () => clearInterval(interval);
  }, []);

  return isWithinAllowedHours;
}

/**
 * Hook para refetchInterval dinâmico baseado no horário comercial
 * @param intervalMs Intervalo em milissegundos quando no horário comercial
 * @returns Intervalo atual ou false se fora do horário comercial
 */
export function useBusinessHoursRefetchInterval(intervalMs: number) {
  const isWithinAllowedHours = useBusinessHours();
  return isWithinAllowedHours ? intervalMs : false;
}

