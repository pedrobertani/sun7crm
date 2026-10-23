# Privacidade e primeiro acesso — SUN7CRM

Revisão de 23/10/2026. Base de implementação, ainda sem autenticação ou banco. Os textos públicos são rascunhos para validação e não certificam adequação à LGPD.

## Referência analisada: StudioPro

Leitura do código da branch principal de `pedrobertani/nail-studio-saas`, em 23/10/2026:

- `app/privacidade/page.tsx`: categorias de dados, bases legais, controlador/operador, Google, compartilhamento, segurança, retenção, direitos e contato.
- `app/termos/page.tsx`: escopo, responsabilidades, integrações, condições comerciais e alterações.
- `app/signup/page.tsx`: confirmação explícita no cadastro por e-mail e antes do OAuth; versões no metadata e tentativa de gravação em `legal_acceptances`.
- `supabase/migrations/20260912150000_add_legal_acceptances.sql`: tabela de confirmação individual, RLS por usuário, somente SELECT/INSERT para usuários autenticados e unicidade por par de versões.

### Pontos úteis e ajustes necessários

| Observação no código consultado | Direção para SUN7CRM |
| --- | --- |
| Documentos públicos com responsabilidades distintas para fornecedor e estabelecimento | Preservar a separação, adaptando ao CRM e à identidade personalizada |
| Versão da Política exibida no StudioPro: 21/09/2026; cadastro registra 16/09/2026 | Uma constante compartilhada pela página e pelo registro; versão não pode divergir do texto |
| Falha no INSERT de confirmação gera console.error e o cadastro segue | Falha de gravação deve impedir liberação no fluxo real e permitir nova tentativa |
| Confirmação encontrada no cadastro | SUN7CRM também precisa conferir ao entrar; contas serão criadas por administrador/gestor, sem cadastro autônomo |
| RLS e registros individuais são uma boa base | A produção deve acrescentar validação de versões no servidor, documento imutável e vínculo verificável à identidade autenticada |
| StudioPro descreve Google e outras integrações operacionais | Não copiar para a demo do SUN7CRM integrações ou controles inexistentes |

Essa revisão se limita aos arquivos acima. Não constitui auditoria completa do StudioPro, do login, de suas políticas de acesso ou da infraestrutura. Não foram feitas alterações no StudioPro.

## O que está implementado na prévia

- Site institucional em `/#/`, recursos em `/#/recursos`, demonstração em `/#/demo` (compatível com `/#/entrar`) e tela de login em `/#/acessar`, ainda sem autenticação e com campos indisponíveis.
- Documentos públicos em `/#/termos` e `/#/privacidade`, disponíveis sem confirmação.
- Dashboard passa a `/#/painel`; demais rotas internas são preservadas.
- A demo abre diretamente no painel após escolher a empresa e o perfil; nenhuma rota de demonstração verifica ou registra aceite.
- Trocar de empresa ou perfil não apresenta documentos nem exige nova confirmação.
- O provider da demo não lê nem grava confirmações; a tela de aceite foi retirada desse fluxo.
- A etapa de aceite individual permanece como requisito da futura autenticação real, sem aceitar automaticamente pela pessoa.
- Voltar ao site retorna à página inicial; Sair encerra a sessão simulada e retorna à entrada da demo.
- Consultas permanentes nas configurações, na aba Privacidade, e no rodapé da área de trabalho.

Versões anteriores simulavam uma confirmação no localStorage. Registros antigos podem continuar no navegador, mas não são lidos nem usados para liberar a demo atual, não comprovam identidade e não serão aproveitados como aceite de uma conta real. Limpar os dados do site remove esses registros. Os documentos continuam preliminares e a demo não contrata serviço nem produz cobrança. As funções de domínio antigas permanecem sem ligação com o fluxo atual; não implementam o requisito de produção abaixo.

## Regras propostas para a autenticação real

1. Autenticar antes de associar a confirmação a uma pessoa. Nunca registrar pelo gestor em nome da equipe.
2. Verificar no servidor o par de versões exigido. A interface sozinha não deve liberar as operações de negócio.
3. Manter documentos publicados em versões imutáveis com identificador, conteúdo e hash. Separar atualização editorial de alteração material que exija nova confirmação.
4. Registrar `user_id`, `company_id` quando aplicável, `terms_version`, `privacy_version`, `accepted_at` gerado pelo servidor e origem. Usar identidade da sessão autenticada, não um ID enviado livremente pelo cliente.
5. Impedir que clientes comuns alterem ou apaguem registros. Usar escrita validada e idempotente; falha mantém o acesso restrito ao fluxo de regularização e aos documentos.
6. Não depender exclusivamente de metadata de autenticação ou de timestamp enviado pelo navegador.
7. Permitir consulta aos documentos e saída sem aceite. Mudanças relevantes são apresentadas de forma clara.
8. A confirmação individual não substitui contrato comercial da empresa, nem autoriza o tratamento de dados de leads e clientes.
9. Não coletar IP ou user-agent por padrão só para montar um comprovante. Avaliar necessidade, base, segurança e retenção se forem adicionados.
10. A aceitação de Termos e a ciência da Política não são consentimento genérico. Quando uma finalidade depender de consentimento, terá escolha específica, evidência e possibilidade de revogação, sem misturar marketing opcional ao uso essencial.

## Decisões que faltam antes dos dados reais

| Tema | Definição necessária |
| --- | --- |
| Fornecedor/controlador da conta | Identificação jurídica, nome, endereço aplicável e contato público |
| Atendimento de privacidade | Canal oficial monitorado, verificação de identidade e encaminhamento de solicitações |
| Dados de cada empresa | Responsabilidades contratuais de controlador/operador e instruções de tratamento |
| Inventário | Categorias, finalidade e base legal por operação; minimização de campos livres |
| Dados de saúde | Fora da demo; qualquer necessidade real exige avaliação específica das hipóteses do art. 11 e controles adequados |
| Infraestrutura | Provedores efetivamente contratados, suboperadores, regiões e transferências internacionais |
| Retenção | Prazos por finalidade, encerramento, exportação, eliminação e ciclo de backups |
| Segurança | Autenticação, RLS/isolamento, autorização no backend, logs mínimos, backups e recuperação |
| Incidentes | Procedimento de detecção, resposta e avaliação de comunicação aplicável |
| Cookies/analytics | Inventário real; se houver tecnologias opcionais, escolhas granulares antes da ativação |
| Documentos finais | Revisão jurídica e publicação dos dados e compromissos efetivos antes da operação |

A identidade visual da empresa não muda a identidade do fornecedor. Não afirmar “100% LGPD”, “dados garantidos no Brasil”, criptografia em repouso ou políticas de segurança sem verificar a implementação e os contratos.

## Bases consultadas

- LGPD, arts. 6, 7, 8, 9, 11, 18 e 46: https://www.presidencia.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- ANPD, direitos dos titulares: https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares
- ANPD, perguntas frequentes: https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes
- ANPD, Nota Técnica 6/2025 (consentimento e dados sensíveis): https://www.gov.br/anpd/pt-br/centrais-de-conteudo/documentos-tecnicos-orientativos/nt-6_2025-fis_cgf_anpd_nota_tecnica__pub__6.pdf/@@display-file/file

## Validação

Os testes de domínio existentes cobrem o registro simulado da implementação anterior; não demonstram controle de acesso real. No navegador, a demo abriu diretamente no painel administrativo, permitiu trocar para Recepção e Casa & Forma sem apresentar documentos e permaneceu acessível após recarregar. A autenticação, o aceite real e o controle no servidor permanecem futuros.
