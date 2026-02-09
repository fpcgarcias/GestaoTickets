import { describe, it, expect } from 'vitest';
import { parseCompanyFilter, expandCompanyFilter } from '../company-filter';

describe('company-filter', () => {
  describe('parseCompanyFilter', () => {
    it('deve retornar true para todos os IDs quando filtro é *', () => {
      const predicate = parseCompanyFilter('*');
      expect(predicate(1)).toBe(true);
      expect(predicate(2)).toBe(true);
      expect(predicate(999)).toBe(true);
    });

    it('deve retornar true para todos os IDs quando filtro é vazio', () => {
      const predicate = parseCompanyFilter('');
      expect(predicate(1)).toBe(true);
      expect(predicate(2)).toBe(true);
    });

    it('deve excluir ID específico quando formato é <>id', () => {
      const predicate = parseCompanyFilter('<>5');
      expect(predicate(1)).toBe(true);
      expect(predicate(5)).toBe(false);
      expect(predicate(10)).toBe(true);
    });

    it('deve incluir apenas IDs na lista quando formato é id1,id2,...', () => {
      const predicate = parseCompanyFilter('1,3,5');
      expect(predicate(1)).toBe(true);
      expect(predicate(2)).toBe(false);
      expect(predicate(3)).toBe(true);
      expect(predicate(4)).toBe(false);
      expect(predicate(5)).toBe(true);
    });

    it('deve incluir apenas ID único quando formato é id', () => {
      const predicate = parseCompanyFilter('7');
      expect(predicate(7)).toBe(true);
      expect(predicate(1)).toBe(false);
      expect(predicate(10)).toBe(false);
    });

    it('deve ignorar valores não-numéricos em listas', () => {
      const predicate = parseCompanyFilter('1,abc,3,xyz');
      expect(predicate(1)).toBe(true);
      expect(predicate(3)).toBe(true);
      expect(predicate(2)).toBe(false);
    });
  });

  describe('expandCompanyFilter', () => {
    const allCompanyIds = [1, 2, 3, 4, 5];

    it('deve retornar todos os IDs quando filtro é *', () => {
      const result = expandCompanyFilter('*', allCompanyIds);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('deve excluir ID específico quando formato é <>id', () => {
      const result = expandCompanyFilter('<>3', allCompanyIds);
      expect(result).toEqual([1, 2, 4, 5]);
    });

    it('deve retornar apenas IDs na lista', () => {
      const result = expandCompanyFilter('1,3,5', allCompanyIds);
      expect(result).toEqual([1, 3, 5]);
    });

    it('deve retornar apenas ID único', () => {
      const result = expandCompanyFilter('2', allCompanyIds);
      expect(result).toEqual([2]);
    });
  });
});
