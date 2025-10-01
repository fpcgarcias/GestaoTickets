import React from 'react';

interface TextWithLinksProps {
  text: string;
  className?: string;
}

// Componente simples para renderizar texto com quebra automática de URLs
export const TextWithBreakAll: React.FC<TextWithLinksProps> = ({ text, className = '' }) => {
  return (
    <div className={`whitespace-pre-line break-all ${className}`}>
      {text}
    </div>
  );
};
