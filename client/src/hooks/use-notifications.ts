import { useWebSocketContext } from '@/contexts/websocket-context';

export function useNotifications() {
  // Apenas expõe o contexto global
  return useWebSocketContext();
}
