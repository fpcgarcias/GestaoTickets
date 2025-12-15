// Teste simples para verificar se as notificações estão funcionando
import { notificationService } from './server/services/notification-service.js';

async function testNotifications() {
  try {
    console.log('🔔 Testando sistema de notificações...');
    
    // Testar envio de notificação para usuário ID 1
    await notificationService.sendNotificationToUser(1, {
      type: 'test_notification',
      title: 'TESTE: Sistema Funcionando',
      message: 'Esta é uma notificação de teste para verificar se o sistema está funcionando',
      priority: 'high',
      timestamp: new Date()
    });
    
    console.log('✅ Notificação de teste enviada com sucesso!');
  } catch (error) {
    console.error('❌ ERRO ao enviar notificação de teste:', error);
    console.error('Stack:', error.stack);
  }
}

testNotifications();