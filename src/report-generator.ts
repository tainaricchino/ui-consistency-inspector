import * as fs from 'fs';
import * as path from 'path';
import { DiffResult } from './comparator';
import { TokenViolation } from './token-linter';

function toBase64DataUri(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const ext = path.extname(filePath).replace('.', '') || 'png';
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:image/${ext};base64,${base64}`;
}

export function generateHtmlReport(
  outputPath: string,
  diffResults: DiffResult[],
  violations: TokenViolation[]
): void {
  const failedVisuals = diffResults.filter((r) => r.status === 'failed').length;
  const overallPassed = failedVisuals === 0 && violations.length === 0;

  const violationsHtml =
    violations.length === 0
      ? '<p class="empty-ok">Nenhuma violação de tokens CSS encontrada.</p>'
      : `<table class="table">
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Linha</th>
              <th>Propriedade</th>
              <th>Valor</th>
              <th>Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            ${violations
              .map(
                (v) => `
              <tr>
                <td><code>${path.basename(v.file)}</code></td>
                <td>${v.line}</td>
                <td><code>${v.property}</code></td>
                <td><span class="pill-err">${v.value}</span></td>
                <td>${v.message}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;

  const visualsHtml = diffResults
    .map((item, idx) => {
      const currentUri = toBase64DataUri(item.currentPath);
      const baselineUri = toBase64DataUri(item.baselinePath);
      const diffUri = item.diffPath ? toBase64DataUri(item.diffPath) : '';

      const badgeLabel =
        item.status === 'passed'
          ? `APROVADO (${item.diffPercentage}% diff)`
          : item.status === 'new-baseline'
          ? 'NOVA BASELINE'
          : `FALHOU (${item.diffPercentage}% diff)`;

      const badgeClass =
        item.status === 'failed' ? 'badge-fail' : 'badge-pass';

      return `
      <div class="card">
        <div class="card-header">
          <h3>${item.fileName}</h3>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </div>

        ${
          item.status === 'new-baseline'
            ? `<p class="hint">Primeira captura registrada. Rode com <code>--approve</code> para salvar como baseline oficial.</p>
               <img src="${currentUri}" class="preview-single" alt="${item.fileName}" />`
            : `
          <div class="compare-grid">
            <div>
              <span class="label">Antes vs. Depois (Arraste o controle)</span>
              <div class="slider-box" id="slider-${idx}">
                <img src="${currentUri}" alt="Depois" />
                <div class="slider-overlay" style="width: 50%;">
                  <img src="${baselineUri}" alt="Antes" />
                </div>
                <input type="range" min="0" max="100" value="50"
                  oninput="this.previousElementSibling.style.width = this.value + '%'" />
              </div>
            </div>
            ${
              diffUri
                ? `<div>
                    <span class="label">Mapa de Diferenças (Pixelmatch)</span>
                    <img src="${diffUri}" class="preview-single" alt="Diff" />
                  </div>`
                : ''
            }
          </div>`
        }
      </div>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>UI Consistency Inspector — Relatório</title>
  <style>
    :root {
      --red: #8B1E24;
      --pink: #F5DAE6;
      --ink: #0F0F0F;
      --white: #FFFFFF;
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--pink);
      color: var(--ink);
      margin: 0;
      padding: 32px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--ink);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .status-banner {
      padding: 8px 16px;
      font-weight: 700;
      border: 2px solid var(--ink);
      background: ${overallPassed ? '#D1FAE5' : '#FEE2E2'};
    }
    .section {
      background: var(--white);
      border: 2px solid var(--ink);
      padding: 24px;
      margin-bottom: 24px;
    }
    .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .table th, .table td {
      text-align: left;
      padding: 10px;
      border-bottom: 1px solid #ddd;
      font-size: 14px;
    }
    .pill-err {
      background: var(--red);
      color: var(--white);
      padding: 2px 8px;
      font-family: monospace;
    }
    .card {
      border: 1px solid var(--ink);
      padding: 16px;
      margin-bottom: 16px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .badge { padding: 4px 10px; font-size: 12px; font-weight: 700; }
    .badge-pass { background: #D1FAE5; color: #065F46; }
    .badge-fail { background: var(--red); color: var(--white); }
    .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .label { display: block; font-size: 12px; font-weight: 700; margin-bottom: 6px; }
    .preview-single { width: 100%; border: 1px solid #ccc; }
    .slider-box { position: relative; overflow: hidden; border: 1px solid #ccc; }
    .slider-box img { display: block; width: 100%; height: auto; }
    .slider-overlay {
      position: absolute; top: 0; left: 0; bottom: 0;
      overflow: hidden; border-right: 3px solid var(--red);
    }
    .slider-overlay img { width: auto; max-width: none; height: 100%; }
    .slider-box input[type="range"] {
      position: absolute; bottom: 12px; left: 5%; width: 90%; z-index: 10;
    }
  </style>
</head>
<body>
  <header class="top">
    <h1>UI Consistency Inspector</h1>
    <div class="status-banner">
      ${overallPassed ? 'AUDITORIA APROVADA' : 'INCONSISTÊNCIAS DETECTADAS'}
    </div>
  </header>

  <section class="section">
    <h2>1. Design System Token Linter (${violations.length} violações)</h2>
    ${violationsHtml}
  </section>

  <section class="section">
    <h2>2. Regressão Visual (${diffResults.length} viewports analisados)</h2>
    ${visualsHtml}
  </section>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf-8');
}