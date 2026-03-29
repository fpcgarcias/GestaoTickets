/**
 * Roles que cada perfil pode atribuir (hierarquia). Deve espelhar o backend (canManageUserRole em authorization.ts).
 * Customer não acessa a tela; support só pode cadastrar solicitante; demais só podem cadastrar cargos abaixo.
 */
export function getAllowedRolesToAssign(actorRole: string): string[] {
  switch (actorRole) {
    case 'admin': return ['customer', 'support', 'triage', 'supervisor', 'manager', 'company_admin', 'admin', 'viewer', 'quality', 'inventory_manager', 'integration_bot'];
    case 'company_admin': return ['customer', 'support', 'triage', 'supervisor', 'manager', 'company_admin', 'viewer', 'quality', 'inventory_manager'];
    case 'manager': return ['customer', 'support', 'triage', 'supervisor', 'viewer'];
    case 'supervisor': return ['customer', 'support', 'triage', 'viewer'];
    case 'support': return ['customer'];
    default: return [];
  }
}

export function canOnlyCreateCustomer(actorRole: string): boolean {
  return actorRole === 'support';
}
