import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    userRole: string;
    companyId?: number;
    adUsername: string; // Nome de usuário no Active Directory
    adData?: any; // Dados adicionais do usuário no AD
  }
} 