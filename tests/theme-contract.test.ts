import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import postcss from 'postcss';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { CRM_THEMES, colorContrast, themePalette, themeStyle } from '../src/lib/themes';

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const sourceFiles = files(sourceRoot);
const colorLiteral = /#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(|\b(?:white|black|navy|green|blue|red)\b/i;

describe('contrato global das identidades', () => {
  it('impede cores fixas nos estilos dos componentes, incluindo regras de hover e modais', () => {
    const violations: string[] = [];
    for (const path of sourceFiles.filter((path) => path.endsWith('.css'))) {
      const text = readFileSync(path, 'utf8');
      const publicStart = text.indexOf('/* Site institucional e primeiro acesso */');
      const publicEnd = text.indexOf(
        '/* Fluxo autenticado separado do ambiente de demonstração. */',
      );
      postcss.parse(text).walkDecls((decl) => {
        const offset = decl.source!.start!.offset!;
        const parent = decl.parent;
        if (parent?.type === 'rule' && parent.selector === ':root') return;
        if (parent?.type === 'atrule' && parent.name === 'theme') return;
        if (publicStart >= 0 && offset >= publicStart && offset < publicEnd) return;
        if (colorLiteral.test(decl.value)) {
          violations.push(`${relative(sourceRoot, path)}:${decl.source!.start!.line} ${decl.prop}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it('impede cores fixas em atributos visuais e estilos inline dos componentes de trabalho', () => {
    const violations: string[] = [];
    for (const path of sourceFiles.filter(
      (path) => path.endsWith('.tsx') && !path.includes('/public/') && !path.endsWith('.test.tsx'),
    )) {
      const ast = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function inspect(node: ts.Node) {
        if (
          ts.isJsxAttribute(node) &&
          /^(style|fill|stroke|tick|contentStyle|itemStyle|labelStyle|stopColor|cursor)$/.test(
            node.name.getText(ast),
          ) &&
          colorLiteral.test(node.initializer?.getText(ast) || '')
        )
          violations.push(`${relative(sourceRoot, path)} ${node.getText(ast)}`);
        ts.forEachChild(node, inspect);
      }
      inspect(ast);
    }
    expect(violations).toEqual([]);
  });

  it('mantém legíveis os estados especiais em todas as sete identidades', () => {
    for (const theme of CRM_THEMES) {
      const t = themePalette(theme.value);
      expect(
        colorContrast(t.danger, t.dangerSurface),
        theme.value + ' erro',
      ).toBeGreaterThanOrEqual(4.5);
      for (const temperature of [t.temperatureHot, t.temperatureWarm, t.temperatureCold]) {
        expect(
          colorContrast(temperature, t.raised),
          theme.value + ' temperatura',
        ).toBeGreaterThanOrEqual(4.5);
      }
      for (const series of t.chart) {
        expect(colorContrast(series, t.surface), theme.value + ' gráfico').toBeGreaterThanOrEqual(
          3,
        );
      }
      expect(themeStyle(theme.value)['--card' as keyof ReturnType<typeof themeStyle>]).toBe(
        t.surface,
      );
    }
  });
});
