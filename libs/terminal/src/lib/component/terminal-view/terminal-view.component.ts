import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  OnDestroy,
  untracked,
  ViewChild,
  inject,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { SerialFacadeService } from '@libs-web-serial';
import { xtermConsoleConfigOptions } from '../../functions';
import { TerminalCommandRequestService } from '@libs-web-serial';
import {
  TerminalConsoleOrchestrationService,
  type TerminalConsoleSink,
} from '../../service';
import { attachTerminalInput } from '../terminal-input';

/**
 * ターミナル表示専用コンポーネント。ライブ表示は {@link SerialFacadeService#terminalText}
 * の累積テキストを差分だけ xterm に書き込む（issue #610）。
 */
@Component({
  selector: 'choh-terminal-view',
  host: {
    class: 'block h-full min-h-0 min-w-0',
  },
  templateUrl: './terminal-view.component.html',
})
export class TerminalViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('consoleDom', { read: ElementRef })
  private consoleDomRef?: ElementRef<HTMLElement>;

  private console = inject(TerminalConsoleOrchestrationService);
  private serial = inject(SerialFacadeService);
  private commandRequests = inject(TerminalCommandRequestService);
  private destroyRef = inject(DestroyRef);

  readonly xterminal = new Terminal(xtermConsoleConfigOptions);

  private readonly fitAddon = new FitAddon();

  private resizeObserver?: ResizeObserver;

  /** キー入力可否（{@link TerminalConsoleOrchestrationService#isConnected} のミラー） */
  private serialInputEnabled = false;

  /**
   * 直前に terminalText から受け取った累積全文。差分書き込みの基準として使う（issue #610）。
   */
  private lastTerminalText = '';
  private bootstrappedEpoch = 0;
  private lastCommandRequestId = 0;

  constructor() {
    effect(() => {
      const connected = this.serial.isConnected();
      this.serialInputEnabled = connected;
      if (!connected) {
        this.lastTerminalText = '';
      }
    });

    effect(() => {
      const text = this.serial.terminalText();
      untracked(() => this.writeTerminalDelta(text));
    });

    effect(() => {
      const epoch = this.serial.connectionEpoch();
      if (epoch <= 0 || epoch === this.bootstrappedEpoch) {
        return;
      }
      this.bootstrappedEpoch = epoch;
      untracked(() => {
        void firstValueFrom(this.runPostConnectInitialization$()).catch(
          (err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            this.xterminal.writeln(
              `[コンソール] 接続後の初期化に失敗しました: ${message}`,
            );
          },
        );
      });
    });

    effect(() => {
      const cmd = this.commandRequests.commandRequest();
      const requestId = this.commandRequests.requestId();
      if (!cmd || requestId === this.lastCommandRequestId) {
        return;
      }
      this.lastCommandRequestId = requestId;
      untracked(() => {
        void this.console.runToolbarCommand(cmd).then((result) => {
          if (result.status === 'not_connected') {
            this.xterminal.writeln(
              `Command failed: Serial port not connected (${cmd})`,
            );
            return;
          }
          if (result.status === 'error') {
            this.xterminal.writeln(
              `Command failed: ${result.message} (${cmd})`,
            );
          }
        });
      });
    });
  }

  ngAfterViewInit(): void {
    this.configTerminal();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.xterminal.dispose();
  }

  private get terminalSink(): TerminalConsoleSink {
    return {
      writeln: (line: string) => this.xterminal.writeln(line),
      write: (chunk: string) => this.xterminal.write(chunk),
    };
  }

  private configTerminal(): void {
    const el = this.consoleDomRef?.nativeElement;
    if (!el) return;

    this.xterminal.loadAddon(this.fitAddon);
    this.xterminal.open(el);
    this.fitTerminal();
    this.resizeObserver = new ResizeObserver(() => this.fitTerminal());
    this.resizeObserver.observe(el);

    this.xterminal.reset();

    attachTerminalInput(
      this.xterminal,
      async (command) => {
        return this.console.runInteractiveCommand(command);
      },
      () => this.serialInputEnabled,
    );
  }

  private fitTerminal(): void {
    try {
      this.fitAddon.fit();
    } catch {
      // Dimensions may be zero before layout stabilizes
    }
  }

  private runPostConnectInitialization$() {
    return this.console.bootstrapAfterConnect$(
      '[コンソール] シリアル接続済み。',
      this.terminalSink,
    );
  }

  private writeTerminalDelta(text: string): void {
    if (text === this.lastTerminalText) {
      return;
    }
    if (text.startsWith(this.lastTerminalText)) {
      const delta = text.slice(this.lastTerminalText.length);
      if (delta) {
        this.xterminal.write(this.normalizeNewlinesForXterm(delta));
      }
    } else {
      this.xterminal.reset();
      if (text) {
        this.xterminal.write(this.normalizeNewlinesForXterm(text));
      }
    }
    this.lastTerminalText = text;
  }

  private normalizeNewlinesForXterm(chunk: string): string {
    return chunk.replace(/\r?\n/g, '\r\n');
  }
}
