import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { InspectorConfig } from './types';
import { lintCssTokens } from './token-linter';
import { captureScreenshots } from './crawler';
import { compareScreenshots } from './comparator';
import { generateHtmlReport } from './report-generator';

const ROOT_DIR = process.cwd();
const CONFIG_PATH = path.join(ROOT_DIR, 'inspector.config.json');
const DEMO_DIR = path.join(ROOT_DIR, 'demo');
const BASELINE_DIR = path.join(ROOT_DIR, 'baselines');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const CURRENT_DIR = path.join(REPORTS_DIR, 'current');
const DIFF_DIR = path.join(REPORTS_DIR, 'diff');

function resolveStaticFile(root: string, requestUrl: string): string | null {
  let pathname = '/';
  try {
    pathname = new URL(requestUrl, 'http://127.0.0.1').pathname;
  } catch {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relative = decoded.replace(/^[/\\]+/, '') || 'index.html';
  const rootPath = path.resolve(root);
  const filePath = path.resolve(rootPath, relative);
  if (filePath !== rootPath && !filePath.startsWith(rootPath + path.sep)) {
    return null;
  }

  return filePath;
}

function startStaticServer(
  dir: string,
  port: number,
  host: string
): Promise<http.Server> {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
  };

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const filePath = resolveStaticFile(dir, req.url ?? '/');
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      fs.createReadStream(filePath).pipe(res);
    });

    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

function isInspectorConfig(value: unknown): value is InspectorConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Partial<InspectorConfig>;
  const tokens = config.designTokens;
  return (
    typeof config.baseUrl === 'string' &&
    typeof config.threshold === 'number' &&
    Array.isArray(config.routes) &&
    Array.isArray(config.viewports) &&
    typeof tokens === 'object' &&
    tokens !== null &&
    Array.isArray(tokens.allowedColors) &&
    Array.isArray(tokens.spacingScalePx)
  );
}

function readConfig(filePath: string): InspectorConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Não foi possível ler ${filePath}: ${message}`);
  }

  if (!isInspectorConfig(raw)) {
    throw new Error(
      `${filePath} precisa de baseUrl, threshold, routes, viewports e designTokens.`
    );
  }

  return raw;
}

function serverTarget(baseUrl: string): { host: string; port: number } {
  const url = new URL(baseUrl);
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Porta inválida em baseUrl: ${baseUrl}`);
  }
  return { host: url.hostname, port };
}

async function run() {
  const isApproveMode = process.argv.includes('--approve');
  const config = readConfig(CONFIG_PATH);

  console.log('Iniciando UI Consistency Inspector...\n');

  // 1. Linter de tokens CSS
  const cssFiles = fs
    .readdirSync(DEMO_DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => path.join(DEMO_DIR, f));

  const violations = lintCssTokens(cssFiles, config);
  console.log(`Tokens CSS: ${violations.length} violação(ões) encontrada(s).`);

  // 2. Sobe servidor local para capturar as telas
  const { host, port } = serverTarget(config.baseUrl);
  const server = await startStaticServer(DEMO_DIR, port, host);

  try {
    const capturedFiles = await captureScreenshots(config, CURRENT_DIR);

    // Se rodar com --approve, promove os prints atuais para baselines/
    if (isApproveMode) {
      fs.mkdirSync(BASELINE_DIR, { recursive: true });
      for (const file of capturedFiles) {
        fs.copyFileSync(
          path.join(CURRENT_DIR, file),
          path.join(BASELINE_DIR, file)
        );
      }
      console.log('\nBaselines atualizadas com sucesso em /baselines!');
      return;
    }

    // 3. Compara com baselines existentes
    const diffResults = compareScreenshots(
      capturedFiles,
      BASELINE_DIR,
      CURRENT_DIR,
      DIFF_DIR,
      config.threshold
    );

    // 4. Gera relatório HTML
    const reportFile = path.join(REPORTS_DIR, 'report.html');
    generateHtmlReport(reportFile, diffResults, violations);
    console.log(`\nRelatório gerado em: ${reportFile}`);

    const hasVisualFailure = diffResults.some((r) => r.status === 'failed');
    if (violations.length > 0 || hasVisualFailure) {
      console.error('Auditoria falhou: inconsistências encontradas.');
      process.exitCode = 1;
    } else {
      console.log('Auditoria concluída sem erros!');
    }
  } finally {
    server.close();
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});