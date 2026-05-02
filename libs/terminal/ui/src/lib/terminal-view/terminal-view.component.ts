import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, filter, merge, switchMap, take } from 'rxjs';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import {
  TerminalCommandRequestService,
  xtermConsoleConfigOptions,
} from '@libs-terminal-util';
import { attachTerminalInput } from '../terminal-input';
import { PI_ZERO_PROMPT } from '@libs-web-serial-util';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import {
  TerminalConsoleOrchestrationService,
  type TerminalConsoleSink,
} from './terminal-console-orchestration.service';

@Component({
  selector: 'choh-terminal-view',
  host: {
    class: 'block h-full min-h-0 min-w-0',
  },
  templateUrl: './terminal-view.component.html',
})
export class TerminalViewComponent implements AfterViewInit, OnDestroy {
  /**
   * シリアル側のシェルプロンプト（サービス側の prompt 待機に渡す）
   */
  readonly remotePrompt = input<string>(PI_ZERO_PROMPT);

  @ViewChild('consoleDom', { read: ElementRef })
  private consoleDomRef?: ElementRef<HTMLElement>;

  private console = inject(TerminalConsoleOrchestrationService);
  private serial = inject(SerialFacadeService);
  private commandRequests = inject(TerminalCommandRequestService);
  private destroyRef = inject(DestroyRef);

  readonly xterminal = new Terminal(xtermConsoleConfigOptions);

  private readonly fitAddon = new FitAddon();

  private commandRequestSub?: Subscription;
  private resizeObserver?: ResizeObserver;

  /** キー入力可否（{@link TerminalConsoleOrchestrationService#isConnected$} のミラー） */
  private serialInputEnabled = false;

  /**
   * 直前に terminalText$ から受け取った累積全文。差分書き込みの基準として使う（issue #610）。
   * `terminalText$` はライブラリが `\r` 再描画を畳んで累積で emit するため、
   * 末尾差分のみを xterm に流し、prefix が一致しない場合は reset + 全文書き込みでフォールバックする。
   */
  private lastTerminalText = '';

  ngAfterViewInit(): void {
    this.configTerminal();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.commandRequestSub?.unsubscribe();
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

    this.console.isConnected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((c) => {
        this.serialInputEnabled = c;
        if (!c) {
          this.lastTerminalText = '';
        }
      });

    this.xterminal.reset();

    this.serial.terminalText$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((text) => this.writeTerminalDelta(text));

    merge(
      this.console.connectionEstablished$,
      this.console.isConnected$.pipe(filter(Boolean), take(1)),
    )
      .pipe(
        take(1),
        switchMap(() =>
          this.console.bootstrapAfterConnect$(
            '[コンソール] シリアル接続済み。',
            this.terminalSink,
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.console.isConnected$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((connected) => {
        if (!connected) {
          this.xterminal.writeln('$ ');
        }
      });

    attachTerminalInput(
      this.xterminal,
      async (command) => {
        return this.console.runInteractiveCommand(command, this.remotePrompt());
      },
      () => this.serialInputEnabled,
    );

    this.commandRequestSub = this.commandRequests.commandRequests$.subscribe(
      (cmd) => {
        void this.console.runToolbarCommand(cmd, this.remotePrompt()).then(
          (result) => {
            if (result.status === 'not_connected') {
              this.xterminal.writeln(`$ ${cmd}`);
              this.xterminal.writeln('Command failed: Serial port not connected');
              this.xterminal.write('$ ');
              return;
            }
            if (result.status === 'error') {
              this.xterminal.writeln(`$ ${cmd}`);
              this.xterminal.writeln(`\r\nCommand failed: ${result.message}`);
              this.xterminal.write('$ ');
              return;
            }
            // success: シェル出力とプロンプトは terminalText$ 差分描画に任せる（#612）
          },
        );
      },
    );
  }

  private fitTerminal(): void {
    try {
      this.fitAddon.fit();
    } catch {
      // Dimensions may be zero before layout stabilizes
    }
  }

  /**
   * `terminalText$` の累積全文を xterm に流す（issue #610）。
   * 通常は前回 emission の末尾に追加された差分のみを `write` し、
   * prefix が変化した場合は安全側に寄せて `reset` してから全文を書き戻す。
   */
  private writeTerminalDelta(text: string): void {
    if (text === this.lastTerminalText) {
      return;
    }
    if (text.startsWith(this.lastTerminalText)) {
      const delta = text.slice(this.lastTerminalText.length);
      if (delta) {
        this.xterminal.write(delta);
      }
    } else {
      this.xterminal.reset();
      if (text) {
        this.xterminal.write(text);
      }
    }
    this.lastTerminalText = text;
  }
}
