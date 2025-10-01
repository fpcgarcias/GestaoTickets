import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './tooltip';

interface ComparisonArrowProps {
  currentValue: number;
  previousValue: number;
  format?: 'number' | 'time'; // 'time' para valores em minutos/horas
  className?: string;
}

export const ComparisonArrow: React.FC<ComparisonArrowProps> = ({ 
  currentValue, 
  previousValue, 
  format = 'number',
  className = '' 
}) => {
  // Se não há valor anterior, não mostrar comparação
  if (previousValue === null || previousValue === undefined) {
    return null;
  }

  // Verificar se os valores são números válidos
  const current = Number(currentValue) || 0;
  const previous = Number(previousValue) || 0;

  // Calcular diferença percentual
  const calculatePercentageChange = (current: number, previous: number): number => {
    // Se o período atual não tem dados ainda, não há o que comparar
    if (current === 0 && previous > 0) {
      return 0;
    }
    // Se o período anterior não tem dados, não há base para comparação
    if (previous === 0) {
      return 0;
    }
    const change = ((current - previous) / previous) * 100;
    // Garantir que não retorne NaN
    return isNaN(change) ? 0 : change;
  };

  const percentageChange = calculatePercentageChange(current, previous);
  const isPositive = percentageChange > 0;
  const isNeutral = Math.abs(percentageChange) < 0.1; // Menos de 0.1% consideramos neutro

  // Para métricas de tempo, crescimento é ruim (vermelho), redução é boa (verde)
  // Para quantidade de tickets, crescimento pode ser neutro/informativo
  const getColorClass = () => {
    if (isNeutral) return 'text-gray-500';
    
    if (format === 'time') {
      // Para tempo: menos tempo = melhor (verde), mais tempo = pior (vermelho)
      return isPositive ? 'text-red-500' : 'text-green-500';
    } else {
      // Para números gerais: apenas informativo (azul para crescimento, laranja para redução)
      return isPositive ? 'text-blue-500' : 'text-orange-500';
    }
  };

  const getIcon = () => {
    if (isNeutral) return <Minus className="h-3 w-3" />;
    return isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
  };

  const formatPercentage = (value: number): string => {
    // Garantir que o valor seja válido antes de formatar
    const validValue = isNaN(value) ? 0 : value;
    return `${Math.abs(validValue).toFixed(1)}%`;
  };

  // Gerar mensagem do tooltip
  const getTooltipMessage = (): string => {
    const percentage = formatPercentage(percentageChange);
    
    if (isNeutral) {
      return 'Valor praticamente inalterado em relação ao período anterior (variação < 0,1%)';
    }
    
    if (format === 'time') {
      if (isPositive) {
        return `⚠️ Tempo aumentou ${percentage} em relação ao período anterior\n(Performance piorou)`;
      } else {
        return `✅ Tempo diminuiu ${percentage} em relação ao período anterior\n(Performance melhorou)`;
      }
    } else {
      if (isPositive) {
        return `📈 Valor aumentou ${percentage} em relação ao período anterior\n(Crescimento de ${current - previous} tickets)`;
      } else {
        return `📉 Valor diminuiu ${percentage} em relação ao período anterior\n(Redução de ${Math.abs(current - previous)} tickets)`;
      }
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 text-xs cursor-help ${getColorClass()} ${className}`}>
            {getIcon()}
            <span>{formatPercentage(percentageChange)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center whitespace-pre-line">
            {getTooltipMessage()}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
