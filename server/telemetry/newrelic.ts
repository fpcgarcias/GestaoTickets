/**
 * Configuração New Relic para monitoramento da aplicação
 * DEVE ser importado ANTES de qualquer outro módulo
 */

// Só inicializar em produção
if (process.env.NODE_ENV === 'production') {
  console.log('🔍 Inicializando New Relic...');
  
  // Importar e inicializar New Relic
  require('newrelic');
  
  console.log('✅ New Relic inicializado com sucesso!');
} else {
  console.log('⚠️  New Relic desabilitado (NODE_ENV não é production)');
}

export {}; // Para tornar este arquivo um módulo ES
