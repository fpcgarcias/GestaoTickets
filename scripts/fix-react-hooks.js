#!/usr/bin/env node

/**
 * Script para corrigir usos de React.useXXX para importações diretas
 * Resolve problemas de contexto corrompido no React 19
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('🔧 Corrigindo usos de React.useXXX...\n');

// Encontrar todos os arquivos com React.use
const files = execSync('grep -r "React\\." client/src --include="*.tsx" --include="*.ts" -l', { encoding: 'utf8' })
  .split('\n')
  .filter(file => file.trim());

const hookPatterns = [
  'useState',
  'useEffect', 
  'useRef',
  'useCallback',
  'useMemo',
  'useContext',
  'useReducer',
  'useImperativeHandle',
  'useLayoutEffect',
  'useDebugValue',
  'useId'
];

let totalFixed = 0;

files.forEach(filePath => {
  if (!filePath.trim()) return;
  
  try {
    let content = readFileSync(filePath, 'utf8');
    let modified = false;
    let hooksUsed = new Set();
    
    // Encontrar quais hooks estão sendo usados com React.
    hookPatterns.forEach(hook => {
      const pattern = new RegExp(`React\\.${hook}`, 'g');
      if (pattern.test(content)) {
        hooksUsed.add(hook);
        // Substituir React.hook por hook
        content = content.replace(new RegExp(`React\\.${hook}`, 'g'), hook);
        modified = true;
      }
    });
    
    if (modified) {
      // Verificar se já tem importações do React
      const hasReactImport = /import.*React.*from ['"]react['"]/.test(content);
      const hasNamedImports = /import\s*\{[^}]*\}\s*from\s*['"]react['"]/.test(content);
      
      if (hooksUsed.size > 0) {
        const hooksArray = Array.from(hooksUsed);
        
        if (hasNamedImports) {
          // Adicionar aos imports existentes
          content = content.replace(
            /import\s*\{([^}]*)\}\s*from\s*['"]react['"]/,
            (match, imports) => {
              const existingImports = imports.split(',').map(i => i.trim()).filter(i => i);
              const newImports = hooksArray.filter(hook => !existingImports.includes(hook));
              if (newImports.length > 0) {
                const allImports = [...existingImports, ...newImports].join(', ');
                return `import { ${allImports} } from 'react'`;
              }
              return match;
            }
          );
        } else if (hasReactImport) {
          // Adicionar import nomeado após o import do React
          content = content.replace(
            /(import.*React.*from ['"]react['"];?\n)/,
            `$1import { ${hooksArray.join(', ')} } from 'react';\n`
          );
        } else {
          // Adicionar import no início do arquivo
          content = `import { ${hooksArray.join(', ')} } from 'react';\n${content}`;
        }
      }
      
      writeFileSync(filePath, content);
      console.log(`✅ Corrigido: ${filePath} (${hooksUsed.size} hooks)`);
      totalFixed++;
    }
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
  }
});

console.log(`\n🎉 Correção concluída! ${totalFixed} arquivos corrigidos.`);
console.log('💡 Reinicie o servidor: npm run dev');