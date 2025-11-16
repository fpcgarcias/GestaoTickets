import { XMLParser } from 'fast-xml-parser';
import s3Service, { UploadResult } from './s3-service';

interface ParsedAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  cityCode?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface ParsedNFeProduct {
  order: number;
  code?: string;
  description?: string;
  ncm?: string;
  cfop?: string;
  cest?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  barCode?: string;
  additionalInfo?: string;
  productCode?: string;
}

export interface ParsedSupplier {
  name?: string;
  tradeName?: string;
  cnpj?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  state?: string;
  phone?: string;
  email?: string;
  address?: ParsedAddress;
}

export interface ParsedBuyer {
  name?: string;
  cnpj?: string;
  cpf?: string;
  stateRegistration?: string;
  state?: string;
  address?: ParsedAddress;
}

export interface ParsedInvoiceTotals {
  totalProducts?: number;
  totalInvoice?: number;
  totalDiscounts?: number;
  totalFreight?: number;
  totalInsurance?: number;
  totalII?: number;
  totalIPI?: number;
  totalICMS?: number;
  totalPis?: number;
  totalCofins?: number;
}

export interface ParsedNFeData {
  invoiceKey?: string;
  invoiceNumber?: string;
  series?: string;
  issueDate?: string;
  entryDate?: string;
  operationNature?: string;
  model?: string;
  supplier: ParsedSupplier;
  buyer: ParsedBuyer;
  products: ParsedNFeProduct[];
  totals: ParsedInvoiceTotals;
  additionalInfo?: string;
  rawXml: string;
  serviceTags?: string[]; // Service tags extraídas (especialmente para Dell)
}

export interface StoreNFeXmlParams {
  xml: string | Buffer;
  companyId: number;
  userId: number;
  invoiceNumber?: string;
  supplierCnpj?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  trimValues: true,
  parseTagValue: true,
  parseAttributeValue: true,
  removeNSPrefix: true,
});

const toNumber = (value?: string | number | null): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeString = (value?: string): string | undefined => {
  if (!value) return undefined;
  return value.toString().trim();
};

const ensureArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

class NFeParserService {
  constructor(private xmlParser = parser) {}

  parseXml(xmlInput: string | Buffer): ParsedNFeData {
    const xmlString = this.normalizeInput(xmlInput);
    const parsed = this.xmlParser.parse(xmlString);
    const infNFe = this.extractInfNFe(parsed);

    if (!infNFe) {
      throw new Error('Não foi possível localizar o nó infNFe no XML da NF-e.');
    }

    const ide = infNFe.ide || {};
    const emit = infNFe.emit || {};
    const dest = infNFe.dest || {};
    const total = infNFe.total?.ICMSTot || {};
    const detList = ensureArray(infNFe.det);

    const supplier: ParsedSupplier = {
      name: normalizeString(emit.xNome),
      tradeName: normalizeString(emit.xFant),
      cnpj: normalizeString(emit.CNPJ),
      stateRegistration: normalizeString(emit.IE),
      municipalRegistration: normalizeString(emit.IM),
      state: normalizeString(emit.endereco?.UF || emit.enderEmit?.UF),
      phone: normalizeString(emit.enderEmit?.fone),
      email: normalizeString(emit.email),
      address: this.parseAddress(emit.enderEmit),
    };

    const buyer: ParsedBuyer = {
      name: normalizeString(dest.xNome),
      cnpj: normalizeString(dest.CNPJ),
      cpf: normalizeString(dest.CPF),
      stateRegistration: normalizeString(dest.IE),
      state: normalizeString(dest.enderDest?.UF),
      address: this.parseAddress(dest.enderDest),
    };

    const products: ParsedNFeProduct[] = detList.map((item, index) => {
      const prod = item?.prod || {};
      return {
        order: index + 1,
        code: normalizeString(prod.cProd),
        description: normalizeString(prod.xProd),
        ncm: normalizeString(prod.NCM),
        cfop: normalizeString(prod.CFOP),
        cest: normalizeString(prod.CEST),
        unit: normalizeString(prod.uCom),
        quantity: toNumber(prod.qCom),
        unitPrice: toNumber(prod.vUnCom),
        totalPrice: toNumber(prod.vProd),
        barCode: normalizeString(prod.cEAN || prod.cEANTrib),
        additionalInfo: normalizeString(prod.infAdProd),
        productCode: normalizeString(prod.codProdANP || prod.cProd),
      };
    });

    const totals: ParsedInvoiceTotals = {
      totalProducts: toNumber(total.vProd),
      totalInvoice: toNumber(total.vNF),
      totalDiscounts: toNumber(total.vDesc),
      totalFreight: toNumber(total.vFrete),
      totalInsurance: toNumber(total.vSeg),
      totalII: toNumber(total.vII),
      totalIPI: toNumber(total.vIPI),
      totalICMS: toNumber(total.vICMS),
      totalPis: toNumber(total.vPIS),
      totalCofins: toNumber(total.vCOFINS),
    };

    // Extrair service tags da Dell (se for nota da Dell)
    const dellCnpj = '72381189001001';
    const isDell = supplier.cnpj?.replace(/\D/g, '') === dellCnpj;
    const serviceTags = isDell ? this.extractDellServiceTags(infNFe.infAdic?.infCpl) : undefined;

    return {
      invoiceKey: normalizeString(this.extractInvoiceKey(parsed)),
      invoiceNumber: normalizeString(ide.nNF),
      series: normalizeString(ide.serie),
      issueDate: normalizeString(ide.dhEmi || ide.dEmi),
      entryDate: normalizeString(ide.dhSaiEnt || ide.dSaiEnt),
      operationNature: normalizeString(ide.natOp),
      model: normalizeString(ide.mod),
      supplier,
      buyer,
      products,
      totals,
      additionalInfo: normalizeString(infNFe.infAdic?.infCpl),
      serviceTags,
      rawXml: xmlString,
    };
  }

  async storeOriginalXml(params: StoreNFeXmlParams): Promise<UploadResult> {
    const buffer = Buffer.isBuffer(params.xml) ? params.xml : Buffer.from(params.xml, 'utf-8');
    const filename = params.invoiceNumber
      ? `nfe-${params.invoiceNumber}.xml`
      : `nfe-${Date.now()}.xml`;

    return s3Service.uploadInventoryFile({
      buffer,
      originalName: filename,
      companyId: params.companyId,
      folder: 'nfe',
      mimeType: 'application/xml',
      metadata: {
        invoiceNumber: params.invoiceNumber,
        supplierCnpj: params.supplierCnpj,
        uploadedBy: params.userId,
        kind: 'nfe',
      },
    });
  }

  private normalizeInput(input: string | Buffer): string {
    if (Buffer.isBuffer(input)) {
      return input.toString('utf-8');
    }
    if (typeof input === 'string') {
      return input;
    }
    throw new Error('Entrada inválida para parser de NF-e.');
  }

  private extractInfNFe(parsed: any) {
    return (
      parsed?.nfeProc?.NFe?.infNFe ||
      parsed?.NFe?.infNFe ||
      parsed?.nfeProc?.infNFe ||
      parsed?.infNFe ||
      null
    );
  }

  private extractInvoiceKey(parsed: any): string | undefined {
    return (
      parsed?.nfeProc?.protNFe?.infProt?.chNFe ||
      parsed?.protNFe?.infProt?.chNFe ||
      parsed?.NFe?.infNFe?.Id ||
      parsed?.nfeProc?.NFe?.infNFe?.Id ||
      undefined
    );
  }

  private parseAddress(addressNode: any): ParsedAddress {
    if (!addressNode) return {};
    return {
      street: normalizeString(addressNode.xLgr),
      number: normalizeString(addressNode.nro),
      complement: normalizeString(addressNode.xCpl),
      neighborhood: normalizeString(addressNode.xBairro),
      city: normalizeString(addressNode.xMun),
      cityCode: normalizeString(addressNode.cMun),
      state: normalizeString(addressNode.UF),
      zipCode: normalizeString(addressNode.CEP),
      country: normalizeString(addressNode.xPais),
    };
  }

  private extractDellServiceTags(infCpl?: string): string[] | undefined {
    if (!infCpl) {
      console.log('[NFe Parser] infCpl está vazio');
      return undefined;
    }

    console.log('[NFe Parser] Procurando service tags no infCpl. Tamanho:', infCpl.length);
    
    // Procurar por padrão de service tags da Dell (ex: 8WHJSF4/HWHJSF4/4XHJSF4...)
    // Service tags da Dell geralmente têm 7 caracteres alfanuméricos separados por "/"
    // Estão no final do texto, antes de uma data (ex: ...8WHJSF4/HWHJSF4...  11/17/2025)
    
    // Buscar sequência de service tags (permite espaços múltiplos antes da data)
    // Padrão: sequência de 6-8 caracteres alfanuméricos separados por "/", seguida de espaços (1 ou mais) e data
    const endPattern = /([A-Z0-9]{6,8}(?:\/[A-Z0-9]{6,8})+)\s+\d{1,2}\/\d{1,2}\/\d{4}/i;
    let match = infCpl.match(endPattern);
    
    if (match && match[1]) {
      console.log('[NFe Parser] Match encontrado com padrão de data:', match[1]);
    } else {
      console.log('[NFe Parser] Não encontrou com padrão de data, tentando sem data...');
      // Se não encontrou com data, buscar sequência de service tags em qualquer lugar
      const generalPattern = /([A-Z0-9]{6,8}(?:\/[A-Z0-9]{6,8}){2,})/i;
      match = infCpl.match(generalPattern);
      
      if (match && match[1]) {
        console.log('[NFe Parser] Match encontrado sem data:', match[1]);
      } else {
        console.log('[NFe Parser] Nenhum match encontrado');
        // Debug: mostrar final do texto para análise
        const lastChars = infCpl.slice(-200);
        console.log('[NFe Parser] Últimos 200 caracteres do infCpl:', lastChars);
      }
    }
    
    if (match && match[1]) {
      // Dividir por "/" e limpar cada service tag
      const tags = match[1]
        .split('/')
        .map(tag => tag.trim().toUpperCase())
        .filter(tag => tag.length >= 6 && tag.length <= 8 && /^[A-Z0-9]+$/.test(tag));
      
      console.log('[NFe Parser] Tags após split e filter:', tags);
      
      // Retornar apenas se houver pelo menos 2 service tags válidas
      if (tags.length >= 2) {
        console.log('[NFe Parser] Service tags extraídas com sucesso:', tags);
        return tags;
      }
    }

    console.log('[NFe Parser] Nenhuma service tag encontrada no infCpl');
    return undefined;
  }
}

export const nfeParserService = new NFeParserService();
export default nfeParserService;

