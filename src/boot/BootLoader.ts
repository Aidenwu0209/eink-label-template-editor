import { reactive, readonly } from 'vue';
import { InitDataParser } from './InitDataParser';
import { UrlParamParser } from './UrlParamParser';
import { ConfigResolver } from './ConfigResolver';
import type { BootConfig, BootState, TemplateResponse } from './types';
import { BootPhase } from './types';

/**
 * Boot Loader — orchestrates the full initialization flow:
 *   InitPayload / URL → API → Config → Ready
 *
 * Must complete BEFORE EditorCore is created.
 */
export class BootLoader {
  private state = reactive<BootState>({
    phase: BootPhase.IDLE,
    progress: 0,
    error: undefined,
    config: undefined,
  });

  private configResolver = new ConfigResolver();

  getState(): Readonly<BootState> {
    return readonly(this.state) as Readonly<BootState>;
  }

  /**
   * Main entry — resolves all config in strict order.
   * Priority: InitDataPayload > URL params with remote fetch.
   */
  async resolve(): Promise<BootConfig> {
    try {
      // ═══ Phase 1: Parse init data ═══
      this.transition(BootPhase.PARSING, 10);

      const payload = InitDataParser.parse();

      if (payload) {
        // Init payload path — validate and resolve directly
        this.transition(BootPhase.VALIDATING, 50);
        const config = this.configResolver.resolveFromPayload(payload);
        this.transition(BootPhase.VALIDATING, 90);

        this.state.config = config;
        this.transition(BootPhase.READY, 100);
        return config;
      }

      // ═══ Legacy URL params path ═══
      const urlParams = UrlParamParser.parse(window.location.search);
      this.transition(BootPhase.PARSING, 25);

      // ═══ Phase 2: Load remote data ═══
      this.transition(BootPhase.LOADING, 30);
      let remoteTemplate: TemplateResponse | undefined;

      if (urlParams.templateId) {
        try {
          const apiBase = urlParams.apiBase || '/api';
          const res = await fetch(`${apiBase}/templates/${urlParams.templateId}`);
          if (res.ok) {
            remoteTemplate = await res.json();
          }
        } catch {
          console.warn('[BootLoader] Failed to load template, continuing without it');
        }
      }
      this.transition(BootPhase.LOADING, 60);

      // ═══ Phase 3: Merge & validate config ═══
      this.transition(BootPhase.VALIDATING, 70);
      const config = this.configResolver.resolve({
        urlParams,
        remoteTemplate,
      });
      this.transition(BootPhase.VALIDATING, 90);

      // ═══ Phase 4: Ready ═══
      this.state.config = config;
      this.transition(BootPhase.READY, 100);
      return config;
    } catch (err) {
      this.state.phase = BootPhase.ERROR;
      this.state.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  private transition(phase: BootPhase, progress: number): void {
    this.state.phase = phase;
    this.state.progress = progress;
  }
}
