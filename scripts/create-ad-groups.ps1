# Script PowerShell para criar grupos do Active Directory
# Para o Sistema de Gestão de Tickets
# Execute este script no servidor de domínio como administrador

# Importar módulo do Active Directory
Import-Module ActiveDirectory

# Definir a OU onde os grupos serão criados (ajuste conforme sua estrutura)
$GroupsOU = "OU=Groups,DC=vixbrasil,DC=local"

# Lista de grupos a serem criados
$Groups = @(
    @{
        Name = "SistemaGestao-Admins"
        Description = "Administradores do Sistema de Gestão de Tickets"
        Role = "admin"
    },
    @{
        Name = "SistemaGestao-CompanyAdmin"
        Description = "Administradores de Empresa do Sistema de Gestão"
        Role = "company_admin"
    },
    @{
        Name = "SistemaGestao-Managers"
        Description = "Gerentes do Sistema de Gestão de Tickets"
        Role = "manager"
    },
    @{
        Name = "SistemaGestao-Supervisors"
        Description = "Supervisores do Sistema de Gestão de Tickets"
        Role = "supervisor"
    },
    @{
        Name = "SistemaGestao-Support"
        Description = "Equipe de Suporte do Sistema de Gestão"
        Role = "support"
    },
    @{
        Name = "SistemaGestao-Triage"
        Description = "Equipe de Triagem do Sistema de Gestão"
        Role = "triage"
    },
    @{
        Name = "SistemaGestao-Quality"
        Description = "Equipe de Qualidade do Sistema de Gestão"
        Role = "quality"
    },
    @{
        Name = "SistemaGestao-Viewers"
        Description = "Visualizadores do Sistema de Gestão"
        Role = "viewer"
    },
    @{
        Name = "SistemaGestao-Customers"
        Description = "Clientes do Sistema de Gestão de Tickets"
        Role = "customer"
    },
    @{
        Name = "SistemaGestao-Bots"
        Description = "Bots de Integração do Sistema de Gestão"
        Role = "integration_bot"
    }
)

Write-Host "🚀 Iniciando criação de grupos do Active Directory..." -ForegroundColor Green
Write-Host "📁 OU de destino: $GroupsOU" -ForegroundColor Yellow
Write-Host ""

# Verificar se a OU existe
try {
    Get-ADOrganizationalUnit -Identity $GroupsOU -ErrorAction Stop
    Write-Host "✅ OU encontrada: $GroupsOU" -ForegroundColor Green
} catch {
    Write-Host "❌ ERRO: OU não encontrada: $GroupsOU" -ForegroundColor Red
    Write-Host "❗ Ajuste a variável `$GroupsOU` no script ou crie a OU primeiro." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Criar cada grupo
foreach ($Group in $Groups) {
    $GroupName = $Group.Name
    $GroupDescription = $Group.Description
    $GroupRole = $Group.Role
    
    Write-Host "🔍 Verificando grupo: $GroupName" -ForegroundColor Cyan
    
    try {
        # Verificar se o grupo já existe
        $ExistingGroup = Get-ADGroup -Identity $GroupName -ErrorAction Stop
        Write-Host "⚠️  Grupo já existe: $GroupName" -ForegroundColor Yellow
        
        # Atualizar descrição se necessário
        if ($ExistingGroup.Description -ne $GroupDescription) {
            Set-ADGroup -Identity $GroupName -Description $GroupDescription
            Write-Host "📝 Descrição atualizada para: $GroupName" -ForegroundColor Blue
        }
        
    } catch [Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException] {
        # Grupo não existe, criar
        try {
            New-ADGroup -Name $GroupName `
                       -GroupCategory Security `
                       -GroupScope Global `
                       -Description $GroupDescription `
                       -Path $GroupsOU
            
            Write-Host "✅ Grupo criado: $GroupName" -ForegroundColor Green
            Write-Host "   📋 Descrição: $GroupDescription" -ForegroundColor Gray
            Write-Host "   🎭 Role: $GroupRole" -ForegroundColor Gray
            
        } catch {
            Write-Host "❌ ERRO ao criar grupo $GroupName`: $_" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ ERRO ao verificar grupo $GroupName`: $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "🎉 Processo concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Adicionar usuários aos grupos apropriados" -ForegroundColor White
Write-Host "2. Configurar as variáveis de ambiente no .env" -ForegroundColor White
Write-Host "3. Testar a autenticação com os endpoints do sistema" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Comandos úteis:" -ForegroundColor Yellow
Write-Host "# Listar todos os grupos criados:" -ForegroundColor Gray
Write-Host "Get-ADGroup -Filter 'Name -like `"SistemaGestao-*`"' | Select Name, Description" -ForegroundColor Gray
Write-Host ""
Write-Host "# Adicionar usuário a um grupo:" -ForegroundColor Gray
Write-Host "Add-ADGroupMember -Identity 'SistemaGestao-Admins' -Members 'usuario.teste'" -ForegroundColor Gray
Write-Host ""
Write-Host "# Verificar membros de um grupo:" -ForegroundColor Gray
Write-Host "Get-ADGroupMember -Identity 'SistemaGestao-Admins'" -ForegroundColor Gray 