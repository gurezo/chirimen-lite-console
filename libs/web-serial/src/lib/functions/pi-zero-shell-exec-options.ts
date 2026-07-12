import type { PiZeroPromptDetectorService } from '../service/pi-zero-prompt-detector.service';
import {
  mergeSerialExecOptions,
  type SerialExecOptions,
} from './serial-exec-options';

/**
 * Pi Zero シェル到達後の `exec$` 向けオプション（bootstrap と同じ promptMatch 照合）。
 */
export function createPiZeroShellExecOptions(
  detector: PiZeroPromptDetectorService,
  overrides?: Partial<SerialExecOptions>,
): SerialExecOptions {
  return mergeSerialExecOptions({
    prompt: '',
    promptMatch: (buf) => detector.isCommandCompleted(buf),
    ...overrides,
  });
}
