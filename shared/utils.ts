export function generateTicketId(prefix: string = 'CS'): string {
  const year = new Date().getFullYear();
  const numbers = Math.floor(Math.random() * 9000) + 1000;
  return `${year}-${prefix.substring(0, 2).toUpperCase()}${numbers}`;
}