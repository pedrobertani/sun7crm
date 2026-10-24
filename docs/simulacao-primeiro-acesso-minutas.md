# SUN7CRM — Simulação de primeiro acesso e aceite (sem validade jurídica)

## Objetivo

Validar **somente o fluxo visual** com as minutas atuais, sem cadastrar versões jurídicas oficiais, remover o bloqueio de acesso real ou alterar o Auth do Supabase.

### Rota

`/#/teste/primeiro-acesso` — router em modo hash.

Após a atualização do site de testes, a URL ficará:
`https://sun7crm-base.dreamygull10.chatgpt.site/#/teste/primeiro-acesso`

A página também fica acessível pela tela de login e pelo aviso `Documentos em preparação` apresentado às contas reais que já trocaram a senha.

### Passo a passo

1. Iniciar simulação usando persona fictícia.
2. Testar validações de senha com **senha inventada** (12 caracteres no mínimo e até 72 bytes).
3. Ler a **minuta** dos Termos de Uso e da Política de Privacidade (conteúdo atual de `src/content/legal-drafts.json`).
4. Marcar separadamente duas caixas de confirmação.
5. Confirmar o **teste**, consultar o resultado e repetir quando desejar.

### Limites

- A simulação **não chama a API do Supabase**, não cria contas e não altera a senha de usuários.
- Não cria linhas em `crm_legal_documents`, `crm_legal_requirements` ou `crm_legal_acceptances`.
- Não persiste dados simulados em localStorage, sessão ou banco: ao recarregar, volta ao início.
- Não dá acesso ao painel real, nem substitui confirmação individual dos documentos oficiais.
- O formulário de login real e a troca obrigatória por Edge Function mantêm as regras atuais.
- Não devem ser usados dados ou senhas reais de colaboradores ou clínicas durante a simulação.
- A implantação no **ChatGPT Sites é separada** do commit do GitHub; esta alteração no repositório não atualiza automaticamente o site.

### Validação

Adicionar teste de rota em `src/app/routes.test.tsx` para assegurar a renderização do aviso de teste e que a simulação não inicializa o repositório fictício. Executar `npm run typecheck`, `npm test` e `npm run build` no ambiente de build antes de publicar. Não confundir a validação estática do código com testes automatizados executados.

Para testar registros de aceite **com identidade real e persistência**, usar futuramente ambiente de homologação separado e documentos aprovados como testes, com política de isolamento e limpeza específica. Não gravar aceites de rascunhos como se fossem documentos vigentes de produção.
