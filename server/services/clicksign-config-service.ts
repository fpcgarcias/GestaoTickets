import { db } from '../db';
import { systemSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface ClicksignConfig {
  accessToken: string | null;
  apiUrl: string;
  webhookSecret: string | null;
  enabled: boolean;
}

class ClicksignConfigService {
  /**
   * Busca configurações da ClickSign para uma empresa
   */
  async getConfig(companyId: number): Promise<ClicksignConfig> {
    const accessToken = await this.getSetting(`clicksign_access_token`, companyId);
    const apiUrl = await this.getSetting(`clicksign_api_url`, companyId) || 'https://sandbox.clicksign.com';
    const webhookSecret = await this.getSetting(`clicksign_webhook_secret`, companyId);
    const enabled = (await this.getSetting(`clicksign_enabled`, companyId)) === 'true';

    return {
      accessToken,
      apiUrl,
      webhookSecret,
      enabled,
    };
  }

  /**
   * Salva configurações da ClickSign para uma empresa
   */
  async saveConfig(companyId: number, config: Partial<ClicksignConfig>): Promise<void> {
    // Sempre salvar os valores fornecidos, mesmo que sejam strings vazias (para permitir limpar)
    if (config.accessToken !== undefined) {
      await this.setSetting(`clicksign_access_token`, config.accessToken, companyId);
    }
    if (config.apiUrl !== undefined) {
      await this.setSetting(`clicksign_api_url`, config.apiUrl, companyId);
    }
    if (config.webhookSecret !== undefined) {
      await this.setSetting(`clicksign_webhook_secret`, config.webhookSecret, companyId);
    }
    if (config.enabled !== undefined) {
      await this.setSetting(`clicksign_enabled`, config.enabled ? 'true' : 'false', companyId);
    }
  }

  /**
   * Obtém access token da empresa
   */
  async getAccessToken(companyId: number): Promise<string | null> {
    return await this.getSetting(`clicksign_access_token`, companyId);
  }

  /**
   * Obtém webhook secret da empresa
   */
  async getWebhookSecret(companyId: number): Promise<string | null> {
    return await this.getSetting(`clicksign_webhook_secret`, companyId);
  }

  /**
   * Obtém API URL da empresa
   */
  async getApiUrl(companyId: number): Promise<string> {
    return await this.getSetting(`clicksign_api_url`, companyId) || 'https://sandbox.clicksign.com';
  }

  /**
   * Verifica se ClickSign está habilitado para a empresa
   */
  async isEnabled(companyId: number): Promise<boolean> {
    const enabled = await this.getSetting(`clicksign_enabled`, companyId);
    return enabled === 'true';
  }

  /**
   * Método auxiliar para buscar uma configuração
   */
  private async getSetting(key: string, companyId: number): Promise<string | null> {
    const compositeKey = `${key}_company_${companyId}`;
    
    const [setting] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(
        and(
          eq(systemSettings.key, compositeKey),
          eq(systemSettings.company_id, companyId)
        )
      )
      .limit(1);

    // Retornar null se não existir ou se for string vazia
    if (!setting || !setting.value || setting.value.trim() === '') {
      return null;
    }

    return setting.value;
  }

  /**
   * Método auxiliar para salvar uma configuração
   */
  private async setSetting(key: string, value: string, companyId: number): Promise<void> {
    const compositeKey = `${key}_company_${companyId}`;

    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(
        and(
          eq(systemSettings.key, compositeKey),
          eq(systemSettings.company_id, companyId)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(systemSettings)
        .set({
          value,
          updated_at: new Date(),
        })
        .where(eq(systemSettings.id, existing.id));
    } else {
      await db
        .insert(systemSettings)
        .values({
          key: compositeKey,
          value,
          company_id: companyId,
          updated_at: new Date(),
        });
    }
  }
}

export const clicksignConfigService = new ClicksignConfigService();
export default clicksignConfigService;

