/**
 * Testes para importação CSV de configurações SLA
 * Feature: static-scan-fixes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parse as csvParse } from 'csv-parse/sync';

describe('CSV Parser para SLA Configurations', () => {
  describe('Parsing básico', () => {
    it('deve parsear CSV simples corretamente', () => {
      const csvData = `empresa_id,departamento_id,tipo_incidente_id
1,2,3
4,5,6`;

      const records = csvParse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({
        empresa_id: '1',
        departamento_id: '2',
        tipo_incidente_id: '3'
      });
    });

    it('deve lidar com campos entre aspas com vírgulas internas', () => {
      const csvData = `nome,descricao
"Teste 1","Descrição com, vírgula"
"Teste 2","Outra descrição"`;

      const records = csvParse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      expect(records).toHaveLength(2);
      expect(records[0].descricao).toBe('Descrição com, vírgula');
    });

    it('deve normalizar CRLF para LF', () => {
      const csvDataWithCRLF = `empresa_id,departamento_id\r\n1,2\r\n3,4`;
      const normalizedCsv = csvDataWithCRLF.replace(/\r\n/g, '\n');

      const records = csvParse(normalizedCsv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({
        empresa_id: '1',
        departamento_id: '2'
      });
    });

    it('deve lidar com aspas escapadas', () => {
      const csvData = `nome,descricao
"Teste ""com aspas""","Descrição normal"`;

      const records = csvParse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      expect(records).toHaveLength(1);
      expect(records[0].nome).toBe('Teste "com aspas"');
    });

    it('deve ignorar linhas vazias', () => {
      const csvData = `empresa_id,departamento_id
1,2

3,4

`;

      const records = csvParse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      expect(records).toHaveLength(2);
    });

    it('deve fazer trim de espaços em branco', () => {
      const csvData = `empresa_id,departamento_id
  1  ,  2  
  3  ,  4  `;

      const records = csvParse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({
        empresa_id: '1',
        departamento_id: '2'
      });
    });
  });

  describe('Validação de cabeçalhos', () => {
    it('deve identificar cabeçalhos ausentes', () => {
      const csvData = `empresa_id,departamento_id
1,2`;

      const records = csvParse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      const expectedHeaders = ['empresa_id', 'departamento_id', 'tipo_incidente_id'];
      const firstRecord = records[0];
      const missingHeaders = expectedHeaders.filter(h => !(h in firstRecord));

      expect(missingHeaders).toContain('tipo_incidente_id');
    });

    it('deve rejeitar CSV com número incorreto de colunas', () => {
      const csvData = `empresa_id,departamento_id
1,2,3`;

      expect(() => {
        csvParse(csvData, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
        });
      }).toThrow('Invalid Record Length');
    });
  });

  describe('Round-trip de dados', () => {
    it('deve preservar dados com caracteres especiais após parse', () => {
      const originalData = {
        nome: 'Teste, com vírgula',
        descricao: 'Descrição "com aspas"',
        observacao: 'Linha 1\nLinha 2'
      };

      // Simular serialização CSV (simplificada)
      const csvLine = `"${originalData.nome}","${originalData.descricao.replace(/"/g, '""')}","${originalData.observacao}"`;
      const csvData = `nome,descricao,observacao\n${csvLine}`;

      const records = csvParse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      expect(records[0].nome).toBe(originalData.nome);
      expect(records[0].descricao).toBe(originalData.descricao);
    });
  });
});
