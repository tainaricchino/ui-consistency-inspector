export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export interface RouteConfig {
  name: string;
  path: string;
}

export interface DesignTokens {
  allowedColors: string[];
  spacingScalePx: number[];
}

export interface InspectorConfig {
  baseUrl: string;
  routes: RouteConfig[];
  viewports: Viewport[];
  designTokens: DesignTokens;
  /** Fração máxima de pixels diferentes para a captura ser aprovada (0 a 1). */
  threshold: number;
}
