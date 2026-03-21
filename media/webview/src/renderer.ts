// ============================================================================
// Renderer adapter for VS Code webview
// This file integrates acoord-3d into the VS Code webview
// ============================================================================

import { createRenderer, type RendererApi, type StoreProvider } from 'acoord-3d';
import { structureStore, displayStore, lightingStore } from './state';

// Create renderer instance with webview's state providers
const provider: StoreProvider = {
  structure: structureStore,
  display: displayStore,
  lighting: lightingStore,
};

// We need to initialize after DOM is ready, so export a function instead
let _renderer: RendererApi | null = null;

export function initRenderer(canvas: HTMLCanvasElement): RendererApi {
  if (_renderer) {
    return _renderer;
  }
  
  _renderer = createRenderer({
    canvas,
    providers: provider,
    onError: (msg: string) => console.error('[acoord-3d]', msg),
    onStatus: (msg: string) => console.log('[acoord-3d]', msg),
    onCameraChange: (_quaternion: any) => {
      // axisIndicator update is handled in app.ts
    },
  });
  
  return _renderer;
}

// For backward compatibility, export a proxy object
export const renderer: RendererApi = new Proxy({} as RendererApi, {
  get(_target, prop) {
    if (!_renderer) {
      throw new Error('Renderer not initialized. Call initRenderer() first.');
    }
    return (_renderer as any)[prop];
  },
});

// Re-export types for backward compatibility
export type { RendererApi, RendererHandlers, UiHooks } from 'acoord-3d';
