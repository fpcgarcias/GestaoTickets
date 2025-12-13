import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CleanupScheduler } from '../cleanup-scheduler';
import { db } from '../../db';
import { notifications, users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

describe('CleanupScheduler - Basic Tests', () => {
  let scheduler: CleanupScheduler;
  let testUserId: number;

  beforeEach(async () => {
    scheduler = new CleanupScheduler();
    
    // Criar usuário de teste
    const [user] = await db.insert(users).values({
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'customer',
      company_id: 1,
    }).returning();
    testUserId = user.id;
  });

  afterEach(async () => {
    // Limpar notificações de teste
    await db.delete(notifications).where(eq(notifications.user_id, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    
    // Parar scheduler se estiver rodando
    scheduler.stop();
  });

  it('should return correct retention settings', () => {
    const settings = scheduler.getRetentionSettings();
    expect(settings.readDays).toBe(90);
    expect(settings.unreadDays).toBe(180);
  });

  it('should cleanup old read notifications', async () => {
    // Criar notificação lida antiga (100 dias)
    const oldDate = new Date(Date.now() - (100 * 24 * 60 * 60 * 1000));
    const readDate = new Date(oldDate.getTime() + (60 * 60 * 1000));

    await db.insert(notifications).values({
      user_id: testUserId,
      type: 'new_ticket',
      title: 'Old notification',
      message: 'This should be deleted',
      priority: 'medium',
      created_at: oldDate,
      read_at: readDate,
    });

    // Criar notificação lida recente (30 dias)
    const recentDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    const recentReadDate = new Date(recentDate.getTime() + (60 * 60 * 1000));

    await db.insert(notifications).values({
      user_id: testUserId,
      type: 'new_ticket',
      title: 'Recent notification',
      message: 'This should remain',
      priority: 'medium',
      created_at: recentDate,
      read_at: recentReadDate,
    });

    // Executar limpeza
    const result = await scheduler.cleanupOldNotifications();

    // Verificar que apenas a notificação antiga foi removida
    expect(result.readCount).toBe(1);
    expect(result.unreadCount).toBe(0);

    // Verificar que apenas a notificação recente permanece
    const remaining = await db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, testUserId));

    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('Recent notification');
  });

  it('should cleanup old unread notifications', async () => {
    // Criar notificação não lida muito antiga (200 dias)
    const veryOldDate = new Date(Date.now() - (200 * 24 * 60 * 60 * 1000));

    await db.insert(notifications).values({
      user_id: testUserId,
      type: 'new_ticket',
      title: 'Very old unread',
      message: 'This should be deleted',
      priority: 'medium',
      created_at: veryOldDate,
      read_at: null,
    });

    // Criar notificação não lida recente (100 dias)
    const oldDate = new Date(Date.now() - (100 * 24 * 60 * 60 * 1000));

    await db.insert(notifications).values({
      user_id: testUserId,
      type: 'new_ticket',
      title: 'Old unread',
      message: 'This should remain',
      priority: 'medium',
      created_at: oldDate,
      read_at: null,
    });

    // Executar limpeza
    const result = await scheduler.cleanupOldNotifications();

    // Verificar que apenas a notificação muito antiga foi removida
    expect(result.readCount).toBe(0);
    expect(result.unreadCount).toBe(1);

    // Verificar que apenas a notificação menos antiga permanece
    const remaining = await db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, testUserId));

    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('Old unread');
    expect(remaining[0].read_at).toBeNull();
  });
});