import { BasePlugin } from '../BasePlugin';
import type { PluginContext } from '@/core/types';
import type { FabricJSON } from '@/boot/types';
import { EinkRenderer } from '@/renderer/EinkRenderer';

/**
 * EinkExportPlugin — enhanced export for E-ink devices
 *
 * Supports three export modes:
 * 1. Fabric JSON (template, re-editable)
 * 2. Dithered PNG/BMP (visual output)
 * 3. Device buffer (raw palette indices for firmware)
 */
export class EinkExportPlugin extends BasePlugin {
  static pluginName = 'EinkExportPlugin';
  readonly name = EinkExportPlugin.pluginName;
  readonly apis = [
    'exportFabricJSON',
    'exportDitheredImage',
    'exportDeviceBuffer',
    'exportPackedBuffer',
    'downloadImage',
  ];

  private renderer: EinkRenderer;

  constructor(context: PluginContext) {
    super(context);
    this.renderer = new EinkRenderer(context.config.screen.profile);
  }

  async exportFabricJSON(): Promise<FabricJSON> {
    return this.editor.exportJSON();
  }

  async exportDitheredImage(format: 'png' | 'bmp' = 'png'): Promise<Blob> {
    const imageData = this.editor.getCanvasImageData();
    const dithered = this.renderer.renderPreview(imageData);
    return this.imageDataToBlob(dithered, format);
  }

  async exportDeviceBuffer(): Promise<Uint8Array> {
    const imageData = this.editor.getCanvasImageData();
    return this.renderer.renderBuffer(imageData);
  }

  async exportPackedBuffer(): Promise<Uint8Array> {
    const raw = await this.exportDeviceBuffer();
    const packed = new Uint8Array(Math.ceil(raw.length / 2));
    for (let i = 0; i < raw.length; i += 2) {
      const hi = raw[i] & 0x0f;
      const lo = i + 1 < raw.length ? raw[i + 1] & 0x0f : 0;
      packed[i >> 1] = (hi << 4) | lo;
    }
    return packed;
  }

  async downloadImage(filename = 'eink-output.png'): Promise<void> {
    const blob = await this.exportDitheredImage('png');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private imageDataToBlob(imageData: ImageData, format: string): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d')!.putImageData(imageData, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), `image/${format}`);
    });
  }
}
