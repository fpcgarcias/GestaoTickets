/**
 * Verifica se o horário atual está dentro da janela permitida para execução do scheduler.
 * 
 * Janela permitida: 06:01 às 20:59 (inclusive)
 * 
 * @param now - Data/hora para verificar (default: new Date())
 * @returns true se está dentro da janela permitida, false caso contrário
 */
export function isWithinAllowedWindow(now: Date = new Date()): boolean {
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Antes de 06:01 → fora da janela
  if (hours < 6 || (hours === 6 && minutes === 0)) {
    return false;
  }

  // Depois de 20:59 → fora da janela
  if (hours > 20) {
    return false;
  }

  // Entre 06:01 e 20:59 (inclusive)
  return true;
}
