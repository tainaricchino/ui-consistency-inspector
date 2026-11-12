import postcss from 'postcss';
import * as fs from 'fs';
import { InspectorConfig } from './types';

export interface TokenViolation {
  file: string;
  line: number;
  property: string;
  value: string;
  rule: 'color' | 'spacing';
  message: string;
}

const SPACING_PROPS = new Set([
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap',
]);

export function lintCssTokens(
  cssFilePaths: string[],
  config: InspectorConfig
): TokenViolation[] {
  const violations: TokenViolation[] = [];
  const allowedColors = new Set(
    config.designTokens.allowedColors.map((c) => c.toUpperCase())
  );
  const allowedSpacing = new Set(config.designTokens.spacingScalePx);

  for (const filePath of cssFilePaths) {
    const cssContent = fs.readFileSync(filePath, 'utf-8');
    const root = postcss.parse(cssContent);

    root.walkDecls((decl) => {
      // Ignora a declaração das variáveis originais no :root
      if (decl.prop.startsWith('--')) return;

      const line = decl.source?.start?.line ?? 0;

      // 1. Verifica cores hexadecimais hardcoded (ex: #ff0000)
      const hexMatches = decl.value.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hexMatches) {
        for (const hex of hexMatches) {
          if (!allowedColors.has(hex.toUpperCase())) {
            violations.push({
              file: filePath,
              line,
              property: decl.prop,
              value: hex,
              rule: 'color',
              message: `Cor "${hex}" fora da paleta oficial. Use uma variável CSS aprovada.`,
            });
          }
        }
      }

      // 2. Verifica espaçamentos em px fora da escala do Design System
      if (SPACING_PROPS.has(decl.prop)) {
        const pxMatches = decl.value.match(/\b(\d+)px\b/g);
        if (pxMatches) {
          for (const rawPx of pxMatches) {
            const numericValue = parseInt(rawPx.replace('px', ''), 10);
            if (!allowedSpacing.has(numericValue)) {
              violations.push({
                file: filePath,
                line,
                property: decl.prop,
                value: rawPx,
                rule: 'spacing',
                message: `Espaçamento "${rawPx}" fora da escala permitida (${config.designTokens.spacingScalePx.join(', ')}px).`,
              });
            }
          }
        }
      }
    });
  }

  return violations;
}