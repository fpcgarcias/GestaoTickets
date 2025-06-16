console.log('Starting detailed debug wrapper...');

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

process.on('warning', (warning) => {
  console.warn('⚠️ WARNING:', warning);
});

process.on('exit', (code) => {
  console.log('🚪 Process exiting with code:', code);
});

try {
  console.log('📦 Importing server...');
  await import('./dist/server.js');
  console.log('✅ Server imported successfully');
} catch (err) {
  console.error('❌ ERROR IMPORTING SERVER:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
} 