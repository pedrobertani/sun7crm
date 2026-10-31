import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

// A demo usa somente localStorage do Chrome deste job: nenhum registro real é escrito.
const target = process.env.SUN7_XSS_URL || 'https://sun7crm.pages.dev';
const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
let executablePath = '';
for (const name of names) {
  try { executablePath = execFileSync('which', [name], { encoding: 'utf8' }).trim(); break; } catch {}
}
assert.ok(executablePath, 'Chrome/Chromium indisponível');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const xss = {
  name: 'QA-XSS-<img src=x onerror=alert(1)>',
  notes: 'QA-XSS-notes-<svg onload=alert(1)>',
  task: 'QA-XSS-task-</button><script>alert(1)</script>',
  service: 'QA-XSS-service-<img src=x onerror=alert(1)>',
  description: 'QA-XSS-description-<svg onload=alert(1)>',
  label: 'QA-XSS-label-<svg onload=alert(1)>',
  card: 'QA-XSS-card-<img src=x onerror=alert(1)>',
};
const errors = [];
page.on('pageerror', err => errors.push(err.message));
await page.addInitScript(() => {
  window.__sun7_xss_alert_count = 0;
  window.alert = () => { window.__sun7_xss_alert_count += 1; };
});
async function visit(path) {
  const r = await page.goto(target + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(r?.status(), 200, 'Pagina indisponivel: ' + path);
  await page.locator('#main').waitFor({ timeout: 15000 });
}
async function snapshot() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sun7crm:prototype:v1') || 'null'));
}
async function assertEscaped(label) {
  const result = await page.evaluate(() => ({
    xssExecution: window.__sun7_xss_alert_count || 0,
    injected: Array.from(document.querySelectorAll('img[onerror],svg[onload],script:not([src])'))
      .filter(el => /QA-XSS|alert\(1\)/.test(el.outerHTML))
      .map(el => el.outerHTML.slice(0, 160)),
    pageError: document.querySelector('.fatal')?.innerText || '',
  }));
  assert.equal(result.xssExecution, 0, 'XSS disparou alert no navegador: ' + label);
  assert.deepEqual(result.injected, [], 'HTML suspeito foi interpretado como DOM: ' + label);
  assert.equal(result.pageError, '', 'Erro do app na pagina ' + label);
  assert.deepEqual(errors, [], 'Erros nao tratados na pagina ' + label);
  console.log('PASSOU:', label, '— HTML tratado como texto; scripts não executados');
}
async function save(dialog, name = 'Salvar') {
  await dialog.getByRole('button', { name, exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 12000 });
}
async function ensureText(text) {
  await page.getByText(text, { exact: true }).first().waitFor({ timeout: 12000 });
}
try {
  await visit('/demo/contatos');
  assert.equal(await page.getByRole('heading', { name: 'Contatos', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Novo contato' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill(xss.name);
  await dialog.getByLabel('Observações').fill(xss.notes);
  await save(dialog);
  assert.ok((await snapshot()).contacts.some(c => c.name === xss.name && c.notes === xss.notes));
  await ensureText(xss.name);
  await assertEscaped('Contato criado pela interface');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await ensureText(xss.name);
  await page.getByRole('button', { name: 'Abrir ' + xss.name }).click();
  dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Observações').inputValue(), xss.notes);
  await assertEscaped('Contato persistido e reaberto');
  await dialog.getByRole('button', { name: 'Fechar' }).click();

  await visit('/demo/tarefas?visualizacao=lista');
  await page.getByRole('button', { name: 'Nova tarefa' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('O que precisa ser feito?').fill(xss.task);
  await save(dialog);
  assert.ok((await snapshot()).tasks.some(t => t.title === xss.task));
  await page.getByPlaceholder('Buscar tarefa').fill('QA-XSS-task-');
  await ensureText(xss.task);
  await assertEscaped('Tarefa criada pela interface');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Buscar tarefa').fill('QA-XSS-task-');
  await ensureText(xss.task);
  await assertEscaped('Tarefa persistida');

  await visit('/demo/catalogo');
  await page.getByRole('button', { name: 'Novo serviço ou produto' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill(xss.service);
  await dialog.getByLabel('Descrição').fill(xss.description);
  await dialog.getByLabel('Valor (R$)').fill('10');
  await save(dialog);
  assert.ok((await snapshot()).catalog.some(c => c.name === xss.service && c.description === xss.description));
  await ensureText(xss.service);
  await ensureText(xss.description);
  await assertEscaped('Catálogo criado pela interface');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ensureText(xss.service);
  await assertEscaped('Catálogo persistido');

  await visit('/demo/etiquetas');
  await page.getByRole('button', { name: 'Nova etiqueta' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill(xss.label);
  await save(dialog);
  assert.ok((await snapshot()).labels.some(c => c.name === xss.label));
  await ensureText(xss.label);
  await assertEscaped('Etiqueta criada pela interface');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ensureText(xss.label);
  await assertEscaped('Etiqueta persistida');

  await visit('/demo/funil/leads');
  // Os dados fictícios do card são gravados somente no localStorage isolado do navegador;
  // testa a renderização dos títulos sem criar oportunidades em empresa real.
  await page.evaluate(({ contactName, cardTitle }) => {
    const key = 'sun7crm:prototype:v1';
    const d = JSON.parse(localStorage.getItem(key));
    const c = d.contacts.find(c => c.name === contactName);
    const board = d.boards.find(b => b.companyId === c.companyId && b.kind === 'leads');
    if (!board) throw Error('Funil Leads não encontrado na demo');
    d.opportunities.unshift({
      id: 'qa-xss-card-fixture',
      companyId: c.companyId,
      contactId: c.id,
      boardId: board.id,
      stageId: board.stages[0].id,
      title: cardTitle,
      value: 1000,
      source: 'qa',
      createdAt: new Date().toISOString(),
      labelIds: [],
      catalogIds: [],
    });
    localStorage.setItem(key, JSON.stringify(d));
  }, { contactName: xss.name, cardTitle: xss.card });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Buscar no quadro').fill('QA-XSS-');
  await ensureText(xss.card);
  await assertEscaped('Kanban com card fictício persistido');
  await page.getByRole('button', { name: 'Abrir ' + xss.name }).first().click();
  await page.getByRole('dialog').getByText(xss.notes, { exact: true }).waitFor();
  await assertEscaped('Detalhe do Kanban com observações persistidas');

  console.log('AUDITORIA_XSS_DEMO_OK: contatos, tarefas, catálogo, etiquetas e Kanban');
} finally {
  await browser.close();
}
