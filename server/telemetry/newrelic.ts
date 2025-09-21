/**
 * Configuração New Relic para monitoramento da aplicação
 * DEVE ser importado ANTES de qualquer outro módulo
 */

// Função para inicializar New Relic
async function initNewRelic() {
  // Só inicializar em produção
  if (process.env.NODE_ENV === 'production') {
    console.log('🔍 Inicializando New Relic...');
    
    // Importar e inicializar New Relic usando import dinâmico
    await import('newrelic');
    
    console.log('✅ New Relic inicializado com sucesso!');
  } else {
    console.log('⚠️  New Relic desabilitado (NODE_ENV não é production)');
  }
}

// Executar a inicialização
await initNewRelic();

export {}; // Para tornar este arquivo um módulo ES
