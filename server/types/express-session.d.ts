import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userRole?: 'admin' | 'company_admin' | 'manager' | 'supervisor' | 'support' | 'triage' | 'customer' | 'viewer' | 'quality' | 'integration_bot';
    companyId?: number;
    adUsername?: string; // Nome de usuário no Active Directory
    adData?: any; // Dados adicionais do usuário no AD
  }
} 