declare module 'acoord-3d' {
  export interface RendererApi {
    init(canvas: HTMLCanvasElement): void;
    renderStructure(structure: any, hooks?: any, options?: { fitCamera?: boolean }): void;
    fitCamera(): void;
    setProjectionMode(mode: 'orthographic' | 'perspective'): void;
    snapCameraToAxis(axis: string): void;
    getScale(): number;
    getRaycaster(): any;
    getMouse(): any;
    getCamera(): any;
    getAtomMeshes(): Map<string, any>;
    getBondMeshes(): any[];
    getDragPlane(): any;
    setControlsEnabled(enabled: boolean): void;
    setOnCameraMove(callback: (() => void) | null): void;
    updateLighting(): void;
    updateDisplaySettings(): void;
    exportHighResolutionImage(options?: { scale?: number }): { dataUrl: string; width: number; height: number } | null;
    updateAtomPosition(atomId: string, position: any): void;
    markDirty(): void;
    rotateCameraBy(axis: string, angleDeg: number): void;
    dispose(): void;
  }

  export interface StoreProvider {
    structure: any;
    display: any;
    lighting: any;
  }

  export interface CreateRendererOptions {
    canvas: HTMLCanvasElement;
    providers?: StoreProvider;
    onError?: (message: string) => void;
    onStatus?: (message: string) => void;
    onCameraChange?: (quaternion: any) => void;
  }

  export function createRenderer(options: CreateRendererOptions): RendererApi;
  
  export function setStoreProvider(provider: StoreProvider): void;
  export function getStructureStore(): any;
  export function getDisplayStore(): any;
  export function getLightingStore(): any;

  export interface RendererHandlers {
    setError: (message: string) => void;
    setStatus: (message: string) => void;
  }

  export interface UiHooks {
    updateCounts: (atomCount: number, bondCount: number) => void;
    updateAtomList: (atoms: any[], selectedIds: string[], selectedId: string | null) => void;
  }

  export function debounce<T extends unknown[], R>(fn: (...args: T) => R, wait?: number): (...args: T) => void;
  export function throttle<T extends unknown[], R>(fn: (...args: T) => R, limit?: number): (...args: T) => void;
}
