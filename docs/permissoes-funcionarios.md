# Funcionários e permissões

Implementação de 25/10/2026. O gestor configura os acessos em **Equipe → Permissões** ou no cadastro de um funcionário.

## Interface

A árvore organiza módulos, recursos e ações: **Funil → Cards → Visualizar / Criar / Editar / Excluir**. Os botões + e − expandem e recolhem os grupos. A seleção parcial aparece no checkbox “Todos”. Cada “Todos” seleciona apenas seu grupo; “Ativar todas as funcionalidades” seleciona as ações disponíveis ao administrador que está configurando. As consultas necessárias são ativadas junto com as ações dependentes.

O alcance dos dados fica separado: carteira própria ou toda a empresa. Administrar funcionários e permissões permite criar contas e configurar outros funcionários da própria empresa. Essa opção não concede administração da plataforma, criação de empresas ou registro de pagamentos de assinatura.

A demo apresenta todas as funcionalidades com dados fictícios e permite experimentar a árvore. Os seletores de perfil foram retirados da entrada e da barra superior. Configurar um funcionário fictício não muda a sessão de demonstração nem cria acesso real.

## Backend

- Catálogo fechado com 50 permissões. Chaves desconhecidas, dependências incompletas, carteiras inválidas e versões antigas são rejeitadas.
- Permissões por vínculo, em `crm_private.employee_access`; consultas públicas retornam apenas o próprio conjunto ou o de um funcionário cuja gestão foi autorizada.
- RLS e comandos de negócio validam ação, empresa, acesso vigente e carteira. Alterações nos checks não dependem da renovação do JWT para valer no banco.
- Os vínculos anteriores mantêm o comportamento existente até serem personalizados. Os códigos internos de perfil continuam apenas para compatibilidade e identificação do gestor principal; não são seletores de função para funcionários.
- Contas novas de funcionários são provisionadas atomicamente com acesso vazio. O frontend salva as permissões após a provisão; se essa segunda etapa falhar, a conta continua sem acesso. O mesmo identificador de solicitação evita uma segunda conta na repetição.
- Administradores delegados concedem somente as ações e o alcance que possuem. Não alteram o próprio acesso, o gestor principal ou um administrador da plataforma. Não redefinem a senha de um funcionário com permissões superiores nem alteram perfis legados para ampliar acesso.
- Mudanças são versionadas e registradas em auditoria privada com autor, horário, valores anteriores e seguintes. Não há senhas no registro.
- Notificações usam as permissões atuais na geração e na leitura. A remoção de um módulo corta a leitura dos seus avisos imediatamente; o cron reconcilia os registros no próximo minuto.
- Consultas de plano continuam possíveis durante o bloqueio para quem tem permissão financeira; os demais módulos seguem a suspensão da assinatura.

## Ações especiais

A configuração de etapas verifica as diferenças separadamente: nome do funil, novas etapas, nomes alterados, reordenação e exclusão. Continua limitado a dez etapas, com transferência dos cards conforme a regra existente.

Excluir um card exige permissão específica e confirmação. A operação retira o card do funil por arquivamento interno, preservando pessoa e histórico; não existe restauração na interface nesta versão. Cards com vendas indicadas vinculadas não podem ser excluídos: o operador deve encerrá-los para preservar o financeiro. Tarefas e registros anteriores não são apagados.

O catálogo oferece somente ações existentes: recursos sem exclusão implementada não recebem um check de exclusão fictício. Importar exige a ação de importação no servidor. Exportar controla a função de download da interface; quem pode visualizar dados consegue lê-los, independentemente da permissão de exportar.

## Validação

Testes de banco cobrem isolamento, leitura/escrita direta, RPCs, criar sem editar, retirada imediata de acesso, delegação, versão concorrente, etapas e exclusão com histórico. Testes do frontend verificam seleção por grupo e dependências. A interface foi conferida em larguras de 320 e 390 pixels, além do desktop, com fixtures locais que bloqueiam a rede.

A homologação com contas reais de gestor e funcionários continua sendo uma etapa separada. Não foram criadas contas, empresas, aceites legais ou dados pessoais remotos para testar a funcionalidade. MFA, e-mail e API de pagamentos continuam no escopo das etapas já previstas.
