var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { useQuery } from '@tanstack/react-query';
// Valores padrão para as configurações do sistema
var defaultSettings = {
    companyName: 'Ticket Wise',
    supportEmail: 'suporte@ticketflow.com.br',
    allowCustomerRegistration: true
};
export function useSystemSettings() {
    // Sempre retornar valores padrão, sem fazer requisições
    // Isto evita causar loops de autenticação
    var _a = useQuery({
        queryKey: ['/api/settings/general'],
        // Se a requisição falhar, não tentar novamente para não sobrecarregar o servidor
        retry: false,
        // Não mostrar erro na UI para configurações (é esperado que usuários não-admin recebam 403)
        throwOnError: false,
        // Tempo de cache mais longo para configurações
        staleTime: 5 * 60 * 1000, // 5 minutos
        // Impedir completamente a execução automática para evitar loops
        enabled: false,
    }), data = _a.data, isLoading = _a.isLoading, error = _a.error;
    // Mesclar configurações carregadas com valores padrão
    var settings = data || defaultSettings;
    return __assign(__assign({}, settings), { 
        // Adiciona também variáveis específicas para mais clareza no código
        settings: settings, isLoading: isLoading, error: error });
}
