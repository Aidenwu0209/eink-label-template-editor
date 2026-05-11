/**
 * Boot Loader type definitions
 */
import type { ScreenProfile, ScreenType } from '@/screen/types';

// ══════════ Editor Mode ══════════

/** Editor initialization mode */
export type EditorMode = 'create' | 'edit';

// ══════════ Init Payload Types ══════════

/** Profile configuration from external system */
export interface ProfileConfig {
  profileId?: string;
  name?: string;
  width: number;
  height: number;
  colorMode: 'BW' | 'BWR' | 'BWRY' | 'E6';
  palette?: Array<{ name: string; value: string }>;
}

/** Preview data for dynamic fields */
export interface PreviewData {
  productName?: string;
  price?: number;
  discount?: number;
  description?: string;
  imageUrl?: string;
  qrContent?: string;
  barcodeContent?: string;
  [key: string]: unknown;
}

/** Save callback provided by host system */
export type OnSaveCallback = (payload: import('@/export/SavePayloadBuilder').SavePayload) => void | Promise<void>;

/** External initialization payload */
export interface EditorInitPayload {
  mode: EditorMode;
  profile: ProfileConfig;
  previewData?: PreviewData;
  templateId?: string;
  templateName?: string;
  fullJson?: FabricJSON;
  staticDynamic?: unknown;
  /** Host-provided save callback — takes priority over saveApi */
  onSave?: OnSaveCallback;
  /** Fallback save API URL when onSave is not provided */
  saveApi?: string;
}

// ══════════ URL Params (legacy) ══════════

/** Raw URL parameters */
export interface UrlParams {
  width?: string;
  height?: string;
  screenType?: string;
  templateId?: string;
  apiBase?: string;
  screenConfigId?: string;
}

// ══════════ Boot Config ══════════

/** Resolved boot configuration — all required fields guaranteed */
export interface BootConfig {
  mode: EditorMode;
  canvas: {
    width: number;
    height: number;
  };
  screen: {
    type: ScreenType;
    profile: ScreenProfile;
    palette: readonly import('@/screen/types').ColorEntry[];
  };
  sourceProfile?: ProfileConfig;
  template?: {
    id: string;
    data: FabricJSON;
  };
  templateName?: string;
  previewData?: PreviewData;
  staticDynamic?: unknown;
  api: {
    baseUrl: string;
  };
  /** Host-provided save callback — takes priority over saveApi */
  onSave?: OnSaveCallback;
  /** Fallback save API URL when onSave is not provided */
  saveApi?: string;
}

// ══════════ Boot State Machine ══════════

/** Boot phase constants */
export const BootPhase = {
  IDLE: 'idle',
  PARSING: 'parsing',
  LOADING: 'loading',
  VALIDATING: 'validating',
  READY: 'ready',
  ERROR: 'error',
} as const;

export type BootPhase = (typeof BootPhase)[keyof typeof BootPhase];

/** Boot state (reactive) */
export interface BootState {
  phase: BootPhase;
  progress: number;
  error?: string;
  config?: BootConfig;
}

// ══════════ Fabric JSON ══════════

/** Fabric JSON structure */
export interface FabricJSON {
  version?: string;
  objects: FabricObjectJSON[];
  background?: string;
  [key: string]: unknown;
}

/** Single Fabric object JSON */
export interface FabricObjectJSON {
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  id?: string;
  extensionType?: string;
  extension?: unknown;
  objects?: FabricObjectJSON[];
  [key: string]: unknown;
}

// ══════════ Remote API Types ══════════

/** Template response from API */
export interface TemplateResponse {
  id: string;
  name: string;
  meta: {
    screenType?: string;
    width?: number;
    height?: number;
  };
  fabricJson: FabricJSON;
}

/** Remote screen config from API */
export interface RemoteScreenConfig {
  type?: string;
  width?: number;
  height?: number;
  palette?: import('@/screen/types').ColorEntry[];
  dithering?: Partial<import('@/screen/types').DitheringConfig>;
}

// ══════════ Errors ══════════

/** Boot config validation error */
export class BootConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootConfigError';
  }
}
