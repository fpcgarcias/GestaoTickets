import { describe, it, expect } from 'vitest';
import { isWithinAllowedWindow } from '../scheduler-window';

describe('scheduler-window', () => {
  describe('isWithinAllowedWindow', () => {
    it('deve retornar false para horários antes de 06:01', () => {
      expect(isWithinAllowedWindow(new Date('2024-01-01T05:59:00'))).toBe(false);
      expect(isWithinAllowedWindow(new Date('2024-01-01T06:00:00'))).toBe(false);
    });

    it('deve retornar true para 06:01', () => {
      expect(isWithinAllowedWindow(new Date('2024-01-01T06:01:00'))).toBe(true);
    });

    it('deve retornar true para horários entre 06:01 e 20:59', () => {
      expect(isWithinAllowedWindow(new Date('2024-01-01T08:00:00'))).toBe(true);
      expect(isWithinAllowedWindow(new Date('2024-01-01T12:00:00'))).toBe(true);
      expect(isWithinAllowedWindow(new Date('2024-01-01T18:30:00'))).toBe(true);
      expect(isWithinAllowedWindow(new Date('2024-01-01T20:59:00'))).toBe(true);
    });

    it('deve retornar false para horários depois de 20:59', () => {
      expect(isWithinAllowedWindow(new Date('2024-01-01T21:00:00'))).toBe(false);
      expect(isWithinAllowedWindow(new Date('2024-01-01T23:59:00'))).toBe(false);
    });

    it('deve usar Date atual quando nenhum parâmetro é fornecido', () => {
      // Este teste apenas verifica que a função não lança erro
      const result = isWithinAllowedWindow();
      expect(typeof result).toBe('boolean');
    });
  });
});
