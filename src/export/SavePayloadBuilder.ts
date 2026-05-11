/**
 * Save Payload Builder — generates the complete template save payload
 * including Full JSON, Static PNG Base64, and Dynamic Metadata.
 */
import type { BootConfig, FabricJSON, FabricObjectJSON, PreviewData } from '@/boot/types';
import { SYSTEM_FIELDS } from '@/fields/constants';

// ══════════ Save Payload Types ══════════

export interface StaticImage {
  type: 'base64';
  format: 'png';
  data: string;
}

export interface Widget {
  id: string;
  type: string;
  fieldId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

export interface DynamicMetadata {
  fontFamily: string;
  reservedFields: string[];
  widgets: Widget[];
}

export interface StaticDynamic {
  staticImage: StaticImage;
  dynamicMetadata: DynamicMetadata;
}

export interface SavePayload {
  templateId: string;
  templateName: string;
  profile: {
    profileId?: string;
    name: string;
    width: number;
    height: number;
    colorMode: string;
    palette: Array<{ name: string; value: string }>;
  };
  fullJson: FabricJSON;
  staticDynamic: StaticDynamic;
}

// ══════════ Reverse Mapping ══════════

const SCREEN_TYPE_TO_COLOR_MODE: Record<string, string> = {
  bw: 'BW',
  tri: 'BWR',
  bwry: 'BWRY',
  six: 'E6',
};

// ══════════ Widget ID Counter ══════════

let widgetCounter = 0;

function resetWidgetCounter(): void {
  widgetCounter = 0;
}

function nextWidgetId(type: string): string {
  widgetCounter++;
  return `${type.toLowerCase()}_${String(widgetCounter).padStart(3, '0')}`;
}

function widgetIdForObject(obj: FabricObjectJSON, type: string): string {
  return obj.id || nextWidgetId(type);
}

// ══════════ Widget Extraction ══════════

function extractWidget(
  obj: FabricObjectJSON,
  previewData?: PreviewData
): Widget | null {
  const ext = (obj as any).extension as Record<string, any> | undefined;
  const extType = (obj as any).extensionType as string | undefined;

  switch (extType) {
    case 'TEXT': {
      if (!ext?.fieldBinding) return null;
      return {
        id: widgetIdForObject(obj, 'text'),
        type: 'TEXT',
        fieldId: ext.fieldBinding,
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        fontSize: (obj as any).fontSize ?? 16,
        fontWeight: (obj as any).fontWeight ?? 'normal',
        color: (obj as any).fill ?? '#000000',
        overflow: ext.overflow ?? 'ellipsis',
        defaultValue: String(previewData?.[ext.fieldBinding] ?? ''),
      };
    }
    case 'PRICE': {
      return {
        id: widgetIdForObject(obj, 'price'),
        type: 'PRICE',
        fieldId: 'price',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        defaultValue: previewData?.price != null ? String(previewData.price) : '',
      };
    }
    case 'DISCOUNT': {
      return {
        id: widgetIdForObject(obj, 'discount'),
        type: 'DISCOUNT',
        fieldId: 'discount',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        format: ext?.formatTemplate ?? '{value}折',
        defaultValue: previewData?.discount != null ? String(previewData.discount) : '',
      };
    }
    case 'IMAGE': {
      if (ext?.source !== 'dynamic') return null;
      return {
        id: widgetIdForObject(obj, 'image'),
        type: 'IMAGE',
        mode: 'dynamic',
        fieldId: 'imageUrl',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        fit: ext?.fitMode ?? 'contain',
      };
    }
    case 'QRCODE': {
      return {
        id: widgetIdForObject(obj, 'qrcode'),
        type: 'QRCODE',
        fieldId: 'qrContent',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        errorCorrection: ext?.errorCorrection ?? 'M',
        margin: ext?.margin ?? 1,
        foregroundColor: ext?.foregroundColor ?? '#000000',
        backgroundColor: ext?.backgroundColor ?? '#FFFFFF',
      };
    }
    case 'BARCODE': {
      return {
        id: widgetIdForObject(obj, 'barcode'),
        type: 'BARCODE',
        fieldId: 'barcodeContent',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        format: 'CODE128',
        showText: ext?.showText ?? true,
        foregroundColor: ext?.foregroundColor ?? '#000000',
        backgroundColor: ext?.backgroundColor ?? '#FFFFFF',
      };
    }
    default:
      return null;
  }
}

// ══════════ Profile Reconstruction ══════════

function buildProfilePayload(config: BootConfig): SavePayload['profile'] {
  if (config.sourceProfile) {
    return {
      profileId: config.sourceProfile.profileId,
      name: config.sourceProfile.name ?? config.screen.profile.displayName,
      width: config.sourceProfile.width,
      height: config.sourceProfile.height,
      colorMode: config.sourceProfile.colorMode,
      palette: config.sourceProfile.palette
        ?? config.screen.profile.palette.map((c) => ({ name: c.name, value: c.hex })),
    };
  }

  const screenType = config.screen.type;
  const colorMode = SCREEN_TYPE_TO_COLOR_MODE[screenType] ?? 'BW';
  const profile = config.screen.profile;

  return {
    profileId: `profile_${config.canvas.width}_${config.canvas.height}_${colorMode.toLowerCase()}`,
    name: profile.displayName,
    width: config.canvas.width,
    height: config.canvas.height,
    colorMode,
    palette: profile.palette.map((c) => ({ name: c.name, value: c.hex })),
  };
}

// ══════════ Template ID Generation ══════════

function generateTemplateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `tpl_${ts}_${rand}`;
}

// ══════════ Public API ══════════

/**
 * Build the complete save payload from current editor state.
 */
export function buildSavePayload(
  config: BootConfig,
  fabricJson: FabricJSON,
  canvasDataURL: string
): SavePayload {
  resetWidgetCounter();

  const previewData = config.previewData;

  // Extract dynamic widgets from Fabric JSON
  const widgets: Widget[] = [];
  for (const obj of fabricJson.objects ?? []) {
    const widget = extractWidget(obj, previewData);
    if (widget) {
      widgets.push(widget);
    }
  }

  return {
    templateId: config.template?.id ?? generateTemplateId(),
    templateName: config.templateName ?? '电子价签模板',
    profile: buildProfilePayload(config),
    fullJson: fabricJson,
    staticDynamic: {
      staticImage: {
        type: 'base64',
        format: 'png',
        data: canvasDataURL,
      },
      dynamicMetadata: {
        fontFamily: 'AlibabaPuHuiTi',
        reservedFields: [...SYSTEM_FIELDS],
        widgets,
      },
    },
  };
}
