import { fabric } from 'fabric';
import { BasePlugin } from '../BasePlugin';
import type { PluginContext } from '@/core/types';
import type { ScreenProfile, ColorEntry } from '@/screen/types';
import { SCREEN_PROFILES } from '@/screen/profiles';
import { findNearestColor, hexToRgb } from '@/renderer/colorUtils';

/**
 * EinkColorPlugin — constrains Fabric object colors to the E-ink palette
 *
 * - Snaps colors on object:added / object:modified
 * - Validates all colors before JSON export
 * - Provides palette API for UI color pickers
 */
export class EinkColorPlugin extends BasePlugin {
  static pluginName = 'EinkColorPlugin';
  readonly name = EinkColorPlugin.pluginName;
  readonly apis = ['getAvailableColors', 'snapColorToPalette', 'isPaletteColor'];

  private profile: ScreenProfile;

  constructor(context: PluginContext) {
    super(context);
    this.profile = context.config.screen.profile;

    this.bindCanvas('object:added', (e: fabric.IEvent) => {
      if (e.target) this.constrainObjectColors(e.target);
    });
    this.bindCanvas('object:modified', (e: fabric.IEvent) => {
      if (e.target) this.constrainObjectColors(e.target);
    });
  }

  getAvailableColors(): ColorEntry[] {
    return [...this.profile.palette];
  }

  snapColorToPalette(hex: string): string {
    const rgb = hexToRgb(hex);
    const { entry } = findNearestColor(rgb[0], rgb[1], rgb[2], this.profile.palette);
    return entry.hex;
  }

  isPaletteColor(hex: string): boolean {
    return this.profile.palette.some(
      (c) => c.hex.toLowerCase() === hex.toLowerCase()
    );
  }

  async hookSaveBefore(json: any): Promise<any> {
    if (json?.objects) {
      this.constrainJsonColors(json.objects);
    }
    return json;
  }

  private constrainObjectColors(obj: fabric.Object): void {
    if (obj.fill && typeof obj.fill === 'string') {
      const snapped = this.snapColorToPalette(obj.fill);
      if (snapped !== obj.fill) obj.set('fill', snapped);
    }
    if (obj.stroke && typeof obj.stroke === 'string') {
      const snapped = this.snapColorToPalette(obj.stroke);
      if (snapped !== obj.stroke) obj.set('stroke', snapped);
    }
    if (obj instanceof fabric.Group) {
      obj.getObjects().forEach((child: fabric.Object) => this.constrainObjectColors(child));
    }
  }

  private constrainJsonColors(objects: any[]): void {
    objects.forEach((obj: any) => {
      if (obj.fill && typeof obj.fill === 'string') {
        obj.fill = this.snapColorToPalette(obj.fill);
      }
      if (obj.stroke && typeof obj.stroke === 'string') {
        obj.stroke = this.snapColorToPalette(obj.stroke);
      }
      if (obj.objects) this.constrainJsonColors(obj.objects);
    });
  }
}
