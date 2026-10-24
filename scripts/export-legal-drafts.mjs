import { readFile, mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const drafts = JSON.parse(await readFile(new URL('src/content/legal-drafts.json', root), 'utf8'));
if (drafts.status !== 'draft') throw new Error('Este exportador aceita apenas minutas.');
const target = new URL('docs/juridico/', root);
await mkdir(target, { recursive: true });
for (const [kind, file, title] of [
  ['terms', 'termos-de-uso-minuta.md', 'Termos de Uso — SUN7CRM'],
  ['privacy', 'politica-de-privacidade-minuta.md', 'Política de Privacidade — SUN7CRM'],
]) {
  const text =
    [
      `# ${title}`,
      `Versão ${drafts.version} · ${drafts.label}`,
      `> **MINUTA — NÃO VIGENTE.** ${drafts.notice}`,
      ...drafts[kind].map((section, index) =>
        [`## ${index + 1}. ${section.heading}`, ...section.paragraphs].join('\n\n'),
      ),
    ].join('\n\n') + '\n';
  await writeFile(new URL(file, target), text);
}
console.log('Minutas exportadas. Nenhum documento oficial ou aceite foi registrado.');
