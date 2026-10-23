# Início da implementação

A base visual aprovada é o ponto de partida do produto. A implementação continua sem banco, backend ou contas reais até a integração de identidade e persistência. As entregas abaixo separam o que pode ser validado agora das dependências do piloto.

## Primeira entrega: acesso e demonstração

- Cabeçalho Acessar → tela de login da conta em `/acessar`.
- Explorar a demo → entrada da demonstração em `/demo`, com empresas e perfis fictícios.
- E-mail, senha e Entrar indisponíveis até a conexão da autenticação. Sem login por dados locais ou cadastro público.
- Recuperação de senha oculta na tela por enquanto; a hierarquia de redefinição permanece definida nas regras de negócio.
- Demo com entrada direta e troca livre de empresa/perfil, sem etapa de aceite. Documentos públicos acessíveis para consulta opcional nos dois caminhos. O aceite individual fica previsto para a sessão real, com registro no servidor; registros antigos da demo não serão usados como evidência.
- Perfil e telas administrativas do Caio fora da demo pública. Código de gerenciamento preservado para o acesso real.

## Próximas entregas, na ordem das dependências

1. **Identidade e autorização:** conectar o provedor, cadastro administrativo de gestor/equipe, sessão real, troca voluntária da própria senha, redefinição hierárquica e aceite por pessoa/versão no servidor.
2. **Persistência isolada por empresa:** migrações, vínculos ativos, RLS, contratos assíncronos, estados de carregamento/falha e testes de isolamento.
3. **Operação comercial:** levar contatos, temperatura, quadros editáveis e tarefas da base local para os serviços protegidos, preservando a aparência aprovada.
4. **Recursos confirmados:** catálogo de serviços/produtos, estratégias mensais e materiais de apoio à conversa. Regras específicas entram como decisões explícitas.
5. **Piloto:** validar permissões com cada perfil, recuperação de acesso, aceite, concorrência, backup/restauração e fluxos completos com empresas de teste.

Cadências, eventos de consulta, embaixadores, cobrança e integrações seguem as pendências registradas em `regras-de-negocio.md`. As decisões provisórias precisam continuar isoladas em configuração ou em regras de domínio, sem ligar automações aos nomes editáveis das etapas.

## Critério de conclusão

Uma tela implementada permite avaliar a experiência. Um fluxo de produção só é considerado entregue após persistência, autorização no servidor, estados de erro e validação das regras aplicáveis. Não liberar dados reais na demonstração pública.
