import React from 'react';

interface TextWithLinksProps {
  text: string;
  className?: string;
}

// Componente para renderizar texto com quebra automática APENAS em URLs
export const TextWithBreakAll: React.FC<TextWithLinksProps> = ({ text, className = '' }) => {
  return (
    <div className={`whitespace-pre-line break-all ${className}`}>
      {text}
    </div>
  );
};

// Componente que quebra linha APENAS em links/URLs
export const TextWithLinkBreaks: React.FC<TextWithLinksProps> = ({ text, className = '' }) => {
  // Regex para identificar URLs (http, https, ftp, etc.)
  const urlRegex = /(https?:\/\/[^\s]+|ftp:\/\/[^\s]+|www\.[^\s]+)/gi;
  
  const parts = text.split(urlRegex);
  
  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {parts.map((part, index) => {
        // Se a parte é uma URL, aplica quebra de palavra apenas nela
        if (urlRegex.test(part)) {
          return (
            <span key={index} className="break-all inline-block">
              {part}
            </span>
          );
        }
        // Para texto normal, mantém normal sem quebra
        return <span key={index} className="whitespace-normal">{part}</span>;
      })}
    </div>
  );
};
