// Script para testar configuração de ambiente
console.log('=== TESTE DE AMBIENTE ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || '5173');
console.log('PWD:', process.cwd());

// Testar se .env existe
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
console.log('\n.env existe?', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  console.log('Conteúdo do .env:');
  const content = fs.readFileSync(envPath, 'utf8');
  console.log(content);
}

console.log('\n=== FIM DO TESTE ==='); 