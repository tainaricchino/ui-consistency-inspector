# UI Consistency Inspector

Audita uma página local em duas frentes: tokens de cor e espaçamento no CSS, e diferença visual entre a captura atual e as imagens em `baselines/`.

## Uso

```bash
npm ci
npx playwright install chromium
npm run audit
```

`npm run audit:approve` substitui as imagens em `baselines/` pela captura atual.

As imagens em `baselines/` foram capturadas no Ubuntu, o mesmo sistema do workflow. Uma captura no Windows pode divergir por causa da renderização de fonte.

A configuração fica em `inspector.config.json`. O relatório sai em `reports/report.html`.

O workflow `.github/workflows/ui-audit.yml` roda `npm run audit` em push e pull request para `main`.
