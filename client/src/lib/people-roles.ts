/**
 * Roles que cada perfil pode atribuir (hierarquia). Deve espelhar o backend (server/endpoints/people.ts).
 * Customer não acessa a tela; support só pode cadastrar solicitante; demais só podem cadastrar cargos abaixo.
 */
export function getAllowedRolesToAssign(actorRole: string): string[] {
  switch (actorRole) {
    case 'admin': return ['customer', 'support', 'supervisor', 'manager', 'company_admin', 'admin', 'viewer'];
    case 'company_admin': return ['customer', 'support', 'supervisor', 'manager', 'company_admin', 'viewer'];
    case 'manager': return ['customer', 'support', 'supervisor', 'viewer'];
    case 'supervisor': return ['customer', 'support', 'viewer'];
    case 'support': return ['customer'];
    default: return [];
  }
}

export function canOnlyCreateCustomer(actorRole: string): boolean {
  return actorRole === 'support';
}
