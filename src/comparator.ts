import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface DiffResult {
  fileName: string;
  status: 'passed' | 'failed' | 'new-baseline';
  diffPercentage: number;
  diffPixels: number;
  totalPixels: number;
  baselinePath: string;
  currentPath: string;
  diffPath?: string;
}

export function compareScreenshots(
  fileNames: string[],
  baselineDir: string,
  currentDir: string,
  diffDir: string,
  threshold: number
): DiffResult[] {
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true });
  }

  const results: DiffResult[] = [];

  for (const fileName of fileNames) {
    const baselinePath = path.join(baselineDir, fileName);
    const currentPath = path.join(currentDir, fileName);
    const diffPath = path.join(diffDir, fileName);

    // Se ainda não existe imagem de referência, registra como nova baseline
    if (!fs.existsSync(baselinePath)) {
      results.push({
        fileName,
        status: 'new-baseline',
        diffPercentage: 0,
        diffPixels: 0,
        totalPixels: 0,
        baselinePath,
        currentPath,
      });
      continue;
    }

    const baselineImg = PNG.sync.read(fs.readFileSync(baselinePath));
    const currentImg = PNG.sync.read(fs.readFileSync(currentPath));

    const width = Math.min(baselineImg.width, currentImg.width);
    const height = Math.min(baselineImg.height, currentImg.height);
    const totalPixels = width * height;

    const diffImg = new PNG({ width, height });

    const diffPixels = pixelmatch(
      baselineImg.data,
      currentImg.data,
      diffImg.data,
      width,
      height,
      { threshold: 0.1 }
    );

    const diffPercentage = Number(((diffPixels / totalPixels) * 100).toFixed(3));
    const sizeChanged =
      baselineImg.width !== currentImg.width ||
      baselineImg.height !== currentImg.height;

    const passed = !sizeChanged && diffPixels / totalPixels <= threshold;

    if (!passed) {
      fs.writeFileSync(diffPath, PNG.sync.write(diffImg));
    }

    results.push({
      fileName,
      status: passed ? 'passed' : 'failed',
      diffPercentage,
      diffPixels,
      totalPixels,
      baselinePath,
      currentPath,
      diffPath: passed ? undefined : diffPath,
    });
  }

  return results;
}