var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import React, { useState } from 'react';
import { ChevronDown, Menu, User, Settings, LogOut, LayoutDashboard, TicketIcon, UserCog } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationCenter } from "@/components/layout/notification-center";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useSystemSettings } from "@/hooks/use-system-settings";
export var Header = function () {
    var _a = useLocation(), location = _a[0], setLocation = _a[1];
    var _b = useState(false), isMobileMenuOpen = _b[0], setIsMobileMenuOpen = _b[1];
    var toast = useToast().toast;
    var companyName = useSystemSettings().companyName;
    var _c = useAuth(), user = _c.user, logout = _c.logout;
    // Use dados do usuário autenticado ou valores padrão
    var currentUser = user || {
        id: 1,
        name: "Usuário",
        email: "usuario@example.com",
        username: "usuario",
        role: "admin",
        avatarUrl: "",
        initials: "U"
    };
    // Função para fazer logout
    var handleLogout = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, logout()];
                case 1:
                    _a.sent();
                    toast({
                        title: "Logout realizado",
                        description: "Você foi desconectado com sucesso.",
                    });
                    // Redirecionar para página de login
                    setLocation('/auth');
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    toast({
                        title: "Erro ao sair",
                        description: "Não foi possível fazer logout.",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    // Função para navegar para configurações
    var goToSettings = function (e) {
        e.preventDefault();
        e.stopPropagation();
        setLocation('/settings');
        // Fechar dropdown após clicar
        var closeDropdown = document.querySelector('[data-radix-dropdown-menu-content-close]');
        if (closeDropdown) {
            closeDropdown.click();
        }
    };
    // Função para navegar para perfil
    var goToProfile = function (e) {
        e.preventDefault();
        e.stopPropagation();
        // Redirecionar para perfil (ou settings por enquanto)
        setLocation('/settings');
        // Fechar dropdown após clicar
        var closeDropdown = document.querySelector('[data-radix-dropdown-menu-content-close]');
        if (closeDropdown) {
            closeDropdown.click();
        }
    };
    return (<header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6">
      <div className="flex items-center">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden mr-4 text-neutral-700">
              <Menu />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <div className="p-6 border-b border-neutral-200">
              <h1 className="text-xl font-semibold text-neutral-900">{companyName}</h1>
            </div>
            <nav className="p-4">
              <a href="/" className={"sidebar-item flex items-center px-4 py-3 rounded-md mb-1 cursor-pointer ".concat(location === "/" ? "active" : "text-neutral-700 hover:bg-neutral-100")}>
                <span className="mr-3 text-lg"><LayoutDashboard size={20}/></span>
                <span className={location === "/" ? "font-medium" : ""}>Painel de Controle</span>
              </a>
              <a href="/tickets" className={"sidebar-item flex items-center px-4 py-3 rounded-md mb-1 cursor-pointer ".concat(location.startsWith("/tickets") ? "active" : "text-neutral-700 hover:bg-neutral-100")}>
                <span className="mr-3 text-lg"><TicketIcon size={20}/></span>
                <span className={location.startsWith("/tickets") ? "font-medium" : ""}>Chamados</span>
              </a>
              <a href="/users" className={"sidebar-item flex items-center px-4 py-3 rounded-md mb-1 cursor-pointer ".concat(location.startsWith("/users") ? "active" : "text-neutral-700 hover:bg-neutral-100")}>
                <span className="mr-3 text-lg"><User size={20}/></span>
                <span className={location.startsWith("/users") ? "font-medium" : ""}>Clientes</span>
              </a>
              <a href="/officials" className={"sidebar-item flex items-center px-4 py-3 rounded-md mb-1 cursor-pointer ".concat(location.startsWith("/officials") ? "active" : "text-neutral-700 hover:bg-neutral-100")}>
                <span className="mr-3 text-lg"><UserCog size={20}/></span>
                <span className={location.startsWith("/officials") ? "font-medium" : ""}>Atendentes</span>
              </a>
              <a href="/settings" className={"sidebar-item flex items-center px-4 py-3 rounded-md mb-1 cursor-pointer ".concat(location.startsWith("/settings") ? "active" : "text-neutral-700 hover:bg-neutral-100")}>
                <span className="mr-3 text-lg"><Settings size={20}/></span>
                <span className={location.startsWith("/settings") ? "font-medium" : ""}>Configurações</span>
              </a>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="text-neutral-800">Bem-vindo, {currentUser.name}!</div>
      </div>

      <div className="flex items-center">
        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 p-1 hover:bg-neutral-100 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name}/>
                <AvatarFallback>{currentUser.initials || currentUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline-block">{currentUser.name}</span>
              <ChevronDown size={16}/>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={goToProfile} className="cursor-pointer">
              <User className="mr-2 h-4 w-4"/>
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={goToSettings} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4"/>
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4"/>
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>);
};
