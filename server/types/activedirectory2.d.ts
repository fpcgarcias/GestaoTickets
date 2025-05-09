declare module 'activedirectory2' {
  interface ADConfig {
    url: string;
    baseDN: string;
    username: string;
    password: string;
    attributes?: {
      user?: string[];
      group?: string[];
    };
    entryParser?: any;
    referrals?: any;
    timeout?: number;
  }

  class ActiveDirectory {
    constructor(config: ADConfig);
    
    authenticate(username: string, password: string, callback: (err: Error | null, auth: boolean) => void): void;
    findUser(username: string, callback: (err: Error | null, user: any) => void): void;
    isUserMemberOf(username: string, groupName: string, callback: (err: Error | null, isMember: boolean) => void): void;
    findUsers(query: string, callback: (err: Error | null, users: any[]) => void): void;
    findGroups(query: string, callback: (err: Error | null, groups: any[]) => void): void;
  }

  export default ActiveDirectory;
} 