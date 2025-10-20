/**
 * Utility functions for AI Bot name internationalization
 */

export const AI_BOT_NAMES = {
  'pt-BR': 'Robô IA',
  'en-US': 'AI Robot',
  'es-ES': 'Robot IA',
  'fr-FR': 'Robot IA',
} as const;

// Nomes que podem estar no banco de dados (versões antigas ou sem acento)
export const AI_BOT_DATABASE_NAMES = [
  'Robô IA',
  'Robo IA', // Versão sem acento (pode estar no banco)
  'AI Robot',
  'Robot IA',
] as const;

export type SupportedLocale = keyof typeof AI_BOT_NAMES;

/**
 * Get the localized name for the AI Bot
 * @param locale - The locale to get the name for
 * @returns The localized name for the AI Bot
 */
export function getAiBotName(locale: string = 'pt-BR'): string {
  const normalizedLocale = locale.replace('_', '-') as SupportedLocale;
  return AI_BOT_NAMES[normalizedLocale] || AI_BOT_NAMES['pt-BR'];
}

/**
 * Check if a user is the AI Bot by name
 * @param name - The name to check
 * @returns True if the name matches any AI Bot name
 */
export function isAiBotName(name: string): boolean {
  return AI_BOT_DATABASE_NAMES.includes(name as any);
}

/**
 * Get the display name for a user, with AI Bot name internationalization
 * @param userName - The user's name from the database
 * @param locale - The current locale
 * @returns The display name for the user
 */
export function getUserDisplayName(userName: string | null | undefined, locale: string = 'pt-BR'): string {
  if (!userName) return '';
  
  // If it's an AI Bot name, return the localized version
  if (isAiBotName(userName)) {
    return getAiBotName(locale);
  }
  
  // For regular users, return their actual name
  return userName;
}
