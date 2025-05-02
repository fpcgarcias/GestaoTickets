/**
 * Gerenciador de transações para operações que precisam de atomicidade
 * Garante que múltiplas operações no banco de dados sejam executadas como uma única unidade
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Executa uma função em uma transação
 * Se a função lançar uma exceção, a transação será revertida
 * Se a função for concluída com sucesso, a transação será confirmada
 * @param callback Função a ser executada dentro da transação
 * @returns O resultado da função de callback
 */
export async function withTransaction<T>(callback: () => Promise<T>): Promise<T> {
  try {
    // Iniciar a transação
    await db.execute(sql`BEGIN`);
    console.log('Transação iniciada');
    
    // Executar o callback
    const result = await callback();
    
    // Confirmar a transação se tudo correu bem
    await db.execute(sql`COMMIT`);
    console.log('Transação confirmada com sucesso');
    
    return result;
  } catch (error) {
    // Reverter a transação em caso de erro
    try {
      await db.execute(sql`ROLLBACK`);
      console.log('Transação revertida devido a erro:', error);
    } catch (rollbackError) {
      console.error('Erro ao reverter transação:', rollbackError);
    }
    
    // Propagar o erro original
    throw error;
  }
}
