# Documentos de uso e privacidade — preparação para publicação

Revisão: 23/10/2026, horário de Brasília, com complementos para planejamento da publicação comercial. Situação: **minutas, não vigentes**.

## Entrega e fonte de conteúdo

As minutas estão em `termos-de-uso-minuta.md` e `politica-de-privacidade-minuta.md`. A fonte compartilhada com as páginas públicas é `src/content/legal-drafts.json`; `node scripts/export-legal-drafts.mjs` atualiza as cópias em Markdown. A versão `2026-10-23-r3` identifica apenas a revisão da minuta. Não é uma versão oficial cadastrada no banco.

Atualização de homologação: a migração `crm_legal_homologation` publicou no banco **duas versões internas** (`homologacao-2026-10-23-r3`) e ativou suas exigências. O aceite individual em `crm_legal_acceptances` é registrado apenas pela própria pessoa autenticada, após eventual troca obrigatória de senha. Os painéis autorizados estão disponíveis para testes **somente com informações fictícias**. A versão comercial definitiva ainda exige validação e novo aceite. A demonstração permanece separada.

## Adaptação do StudioPro

Referência lida diretamente da branch principal de `pedrobertani/nail-studio-saas`: `app/termos/page.tsx` e `app/privacidade/page.tsx`, em 23/10/2026. Foram aproveitados a organização por finalidade, a distinção entre estabelecimento e fornecedor e a estrutura de direitos e segurança. Não foram copiados o e-mail, o telefone, os planos, o teste gratuito, a identificação ou as integrações do StudioPro. O StudioPro não foi alterado.

Os textos foram ajustados ao CRM e ao estado efetivo da entrega. Login real, notificações e banco já existem; os módulos da demonstração não são apresentados como integrações operacionais concluídas. O aceite individual é separado do contrato comercial e da base legal dos contatos. Não foi prometida conformidade integral ou certificação LGPD.

## Distribuição de responsabilidades

| Parte                                                    | Responsabilidade prevista                                                                                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empresa contratante, em regra controladora dos cadastros | Definir finalidades e bases legais; informar clientes; justificar origem, necessidade e duração dos dados; controlar a equipe; atender direitos e conduzir suas campanhas de forma lícita |
| Integrantes da equipe                                    | Usar a conta individual, proteger credenciais e dispositivos e agir dentro das atribuições da empresa                                                                                     |
| Fornecedor SUN7CRM, operador dos cadastros               | Seguir instruções lícitas, proteger e restringir acesso, cooperar com direitos e incidentes e gerir suboperadores e encerramento                                                          |
| Fornecedor SUN7CRM, controlador de tratamentos próprios  | Justificar e informar o tratamento necessário à administração de contas, contratação, suporte, segurança e cumprimento de obrigações                                                      |

O pedido de atribuir toda a responsabilidade ao usuário não foi convertido em cláusula de exoneração integral. LGPD, arts. 39, 42, 44 a 46, e CDC, art. 51 quando aplicável, preservam obrigações e responsabilidades próprias do fornecedor. A condição de controlador ou operador depende da atividade concreta. A aceitação pela equipe não substitui a base legal ou o consentimento específico do cliente.

## Situação verificada e pendências

| Tema                                 | Evidência e providência                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identificação do fornecedor          | SUN7CRM é marca e Caio é o responsável pelo produto. Dados fornecidos pelo usuário: SUN7 NEUROMARKETING LTDA - ME, CNPJ 62.325.920/0001-37, com sede em Ourinhos/SP. Falta o endereço de contato completo. Esta revisão não certifica a situação cadastral perante a Receita Federal. Pedro não é identificado como fornecedor apenas por desenvolver o produto. Não inventar endereço ou divulgar CPF de pessoa física sem necessidade. |
| Canal de privacidade                 | Existe WhatsApp comercial no site, mas sua designação como canal de privacidade não foi confirmada. Confirmar um canal monitorado e quem atende direitos e incidentes; identificar encarregado se exigido. Não criar e-mail fictício.                                                                                                                                                                                                    |
| Banco principal                      | Projeto `oduhbimlxnuyqliayvpl`, consultado no Supabase: região `sa-east-1`, correspondente a São Paulo. A localização do banco está confirmada; isso não certifica conformidade nem residência de todos os serviços.                                                                                                                                                                                                                     |
| Cadeia de fornecedores               | Supabase para banco e Auth; Sites e Cloudflare para publicação/entrega do site. Concluir identificação contratual, suboperadores, acesso de suporte, execução das funções, registros técnicos, backups e destinos de dados.                                                                                                                                                                                                              |
| Transferências internacionais        | Verificar os fluxos reais e o mecanismo aplicável do art. 33 da LGPD e Resolução ANPD 19/2024. O DPA público consultado do Supabase contempla processamento global e SCCs europeias; sua leitura não demonstra que cláusulas brasileiras tenham sido celebradas para este projeto. Não marcar a pendência como resolvida por haver região brasileira.                                                                                    |
| Retenção                             | Fixar os prazos concretos de dados operacionais após encerramento, exportação assistida, logs técnicos, eventos administrativos, confirmações e backups; justificar cada prazo. Não há expurgo automático comprovado nesta entrega. A política não pode prometer um prazo ou recurso que não esteja operacional.                                                                                                                         |
| Exportação, eliminação e restauração | Definir o responsável e executar teste com dados fictícios, incluindo dependências e restrições de referências do banco. Definir tratamento de solicitações e como evitar reintroduzir dados eliminados ao restaurar backup. Não afirmar que exista autosserviço de exportação/exclusão.                                                                                                                                                 |
| Registros legais de acesso           | Verificar incidência do art. 15 do Marco Civil e atendimento da guarda de seis meses quando aplicável. Trace de exceção, aceite ou log de auditoria não substitui registro de acesso de aplicação com seus elementos legais.                                                                                                                                                                                                             |
| Incidentes                           | Formalizar recebimento, contenção, investigação, preservação, avaliação do risco, responsáveis e comunicação. Prazo geral da Resolução 15/2024: três dias úteis para comunicação do controlador à ANPD e aos titulares quando devida, observadas exceções e regras específicas. Não presumir enquadramento de pequeno porte.                                                                                                             |
| Saúde e menores                      | Escopo comercial atual não habilita prontuário, dados sensíveis ou cadastro de crianças/adolescentes. Interesses e observações também podem revelar saúde. Qualquer ampliação exige análise específica e controles, não apenas mudança de texto.                                                                                                                                                                                         |
| Segurança e armazenamento            | Controles de Auth, troca temporária, RLS, autorização e logger reduzido existem e têm testes. A sessão real usa armazenamento do navegador; a demo mantém dados fictícios locais. O código revisado não instala pixels de publicidade. Confirmar também práticas dos fornecedores e procedimento de recuperação.                                                                                                                         |

## Infraestrutura de backups para lançamento (decisão de produto)

- **Situação atual confirmada:** organização do projeto SUN7CRM no plano Free; não afirmar que Pro ou rotina contratada de backups já esteja ativa.
- **Decisão de lançamento:** migrar a organização/projeto para Supabase Pro **antes** de aceitar clientes reais. O Pro oferece backups automáticos diários do banco PostgreSQL e janela de sete dias disponíveis, segundo [documentação do provedor](https://supabase.com/docs/guides/platform/backups).
- **Recuperação prevista:** diante de incidente, avaliar restaurar cópia para **novo projeto isolado** e depois recuperar seletivamente registros de um tenant, verificando dependências e preservando as atualizações de produção. A função [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project) está em beta, depende de plano pago com backup físico, clona TODO o banco (inclusive Auth dos usuários e dados de todas as clínicas), requer acesso estritamente restrito, permite custos adicionais, e não inclui arquivos do Storage, Edge Functions ou configuração completa do Auth.
- **Limitações:** o backup diário pode não conter alterações posteriores; não prometer perda zero, restauro de registro único sob demanda, tempo garantido de recuperação ou ausência de indisponibilidade.
- **Storage:** tratar arquivos e logotipos separadamente, pois backups PostgreSQL guardam apenas seus metadados.
- **Checklist antes de clientes reais:** confirmar Pro ativo e backups visíveis; verificar elegibilidade e custos de clone; testar recuperação em ambiente isolado com dados fictícios; validar extração por empresa, chaves estrangeiras e reaplicação de exclusões; controlar credenciais do clone; documentar auditoria e destruição do projeto temporário; determinar prazos distintos de exportação, conservação e exclusão dos demais dados; validar juridicamente as versões finais.

## Homologação interna com autenticação real

- As duas versões `homologacao-2026-10-23-r3` dos Termos e da Política estão ativas no banco. O conteúdo é imutável e possui SHA-256 calculado pelo servidor.
- Cada usuário cadastrado entra em `/#/acessar`, define sua senha pessoal quando necessário e confirma separadamente os dois documentos. A confirmação individual gera registros reais no banco, não simulados.
- Após aceite e autorização por papel/tenant, o painel é liberado para procedimentos internos. **Usar somente registros fictícios**: o projeto ainda utiliza o plano Free e não concluiu a auditoria de produção.
- A rota `/#/teste/primeiro-acesso` e a página de aceite simulado foram eliminadas do código. A vitrine `/#/demo` continua separada como apresentação do produto.
- Antes da comercialização: contratar Pro, validar backups e procedimento de recuperação, fechar prazos de retenção e exclusão, concluir revisão jurídica e auditoria de segurança e publicar **novas versões definitivas** dos documentos, gerando uma nova exigência de aceite por usuário.
- O código da branch precisa ser publicado separadamente no ChatGPT Sites; escrever no GitHub não atualiza automaticamente o site.

## Publicação definitiva

1. Completar o endereço de contato e o canal; validar o inventário, as definições de retenção e os procedimentos acima. A análise jurídica deve considerar quem efetivamente prestará o serviço e as condições reais de contratação.
2. Substituir a redação de pendências por informações verificadas. Revisar a versão final com o responsável pelo produto e por sua operação. Remover o aviso de minuta somente quando o texto estiver concluído.
3. Atribuir nova versão oficial aos dois documentos e publicar o conteúdo integral, imutável, com hash gerado no servidor. Manter os mesmos textos na consulta pública e no primeiro acesso, sem importar a minuta como se fosse oficial. Não editar um documento já publicado.
4. Definir as duas exigências vigentes no servidor somente após a conclusão. Conferir que usuários sem documentos/aceites atuais continuam bloqueados; nenhuma conta recebe aceite automático, inclusive ADM.
5. Cada usuário entra, lê, aceita os Termos e confirma ciência da Política por sua própria conta. Testar um aceite com dados de teste e identidade do próprio titular; o administrador não confirma por funcionários ou clientes.

Este arquivo é um roteiro de conclusão. Não é um script de liberação e não concede exceção ao bloqueio atual.

## Fontes oficiais consultadas

- LGPD, texto compilado: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- CDC, art. 51: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Marco Civil da Internet, art. 15: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- ANPD, guia de agentes de tratamento: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado
- ANPD, Resolução 15/2024 (publicação reproduzida por órgão público): https://www.lgpd.ms.gov.br/wp-content/uploads/2024/05/REGULAMENTO-DE-COMUNICACAO-DE-INCIDENTE-DE-SEGURANCA-ABRIL-2024-ANPD-.pdf
- ANPD, Resolução 19/2024 e retificação indicada na página: https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024
- Supabase, regiões: https://supabase.com/docs/guides/platform/regions
- Supabase, DPA público, versão de 01/08/2026: https://supabase.com/legal/customer-resources/data-processing-addendum

As fontes foram usadas para redigir a estrutura e localizar obrigações. Elas não comprovam que a contratação com cada fornecedor, o atendimento aos titulares ou todos os procedimentos operacionais já estejam formalizados.
