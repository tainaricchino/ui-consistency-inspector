import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { InspectorConfig } from './types';

export async function captureScreenshots(
  config: InspectorConfig,
  outputDir: string
): Promise<string[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const capturedFiles: string[] = [];

  try {
    for (const viewport of config.viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });

      const page = await context.newPage();

      for (const route of config.routes) {
        const url = `${config.baseUrl}${route.path}`;
        await page.goto(url, { waitUntil: 'networkidle' });

        // Congela animações e transições para evitar falsos positivos
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `,
        });

        // Garante que todas as fontes terminaram de carregar
        await page.evaluate(() => document.fonts.ready);

        // Mascara elementos marcados com data-ui-ignore
        await page.evaluate(() => {
          document.querySelectorAll('[data-ui-ignore]').forEach((el) => {
            (el as HTMLElement).style.visibility = 'hidden';
          });
        });

        const fileName = `${route.name}-${viewport.name}.png`;
        const filePath = path.join(outputDir, fileName);

        await page.screenshot({ path: filePath, fullPage: true });
        capturedFiles.push(fileName);
        console.log(`Capturado: ${fileName}`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  return capturedFiles;
}