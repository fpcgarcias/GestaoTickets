var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
export function useNotifications() {
    var _a = useAuth(), user = _a.user, isAuthenticated = _a.isAuthenticated;
    var toast = useToast().toast;
    var _b = useState(null), socket = _b[0], setSocket = _b[1];
    var _c = useState(false), connected = _c[0], setConnected = _c[1];
    var _d = useState([]), notifications = _d[0], setNotifications = _d[1];
    var _e = useState(0), unreadCount = _e[0], setUnreadCount = _e[1];
    // Inicializar a conexão WebSocket
    useEffect(function () {
        if (!isAuthenticated || !user) {
            // Se o usuário não estiver autenticado, não conectar
            if (socket) {
                socket.close();
                setSocket(null);
                setConnected(false);
            }
            return;
        }
        // Configurar o WebSocket
        var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        var wsUrl = "".concat(protocol, "//").concat(window.location.host, "/ws");
        var newSocket = new WebSocket(wsUrl);
        // Configurar os manipuladores de eventos
        newSocket.onopen = function () {
            console.log('Conexão WebSocket estabelecida');
            setConnected(true);
            // Enviar mensagem de autenticação
            var authMessage = {
                type: 'auth',
                userId: user.id,
                userRole: user.role,
            };
            newSocket.send(JSON.stringify(authMessage));
        };
        newSocket.onmessage = function (event) {
            try {
                var notification_1 = JSON.parse(event.data);
                console.log('Notificação recebida:', notification_1);
                // Adicionar à lista de notificações
                setNotifications(function (prev) { return __spreadArray([notification_1], prev, true); });
                // Incrementar a contagem de notificações não lidas para notificações não welcome
                if (notification_1.type !== 'welcome') {
                    setUnreadCount(function (count) { return count + 1; });
                    var variant = 'default';
                    // Determinar a variação do toast com base na prioridade
                    if (notification_1.priority === 'high' || notification_1.priority === 'critical') {
                        variant = 'destructive';
                    }
                    toast({
                        title: notification_1.title,
                        description: notification_1.message,
                        variant: variant === null ? undefined : variant,
                    });
                }
            }
            catch (error) {
                console.error('Erro ao processar notificação:', error);
            }
        };
        newSocket.onclose = function () {
            console.log('Conexão WebSocket fechada');
            setConnected(false);
        };
        newSocket.onerror = function (error) {
            console.error('Erro na conexão WebSocket:', error);
            setConnected(false);
        };
        setSocket(newSocket);
        // Limpar ao desmontar
        return function () {
            if (newSocket) {
                newSocket.close();
            }
        };
    }, [isAuthenticated, user, toast]);
    // Função para marcar todas as notificações como lidas
    var markAllAsRead = function () {
        setUnreadCount(0);
    };
    return {
        connected: connected,
        notifications: notifications,
        unreadCount: unreadCount,
        markAllAsRead: markAllAsRead,
    };
}
