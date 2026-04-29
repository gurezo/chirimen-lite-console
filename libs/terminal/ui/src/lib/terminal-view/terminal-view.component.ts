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
import { EMPTY, Subscription, switchMap, take } from 'rxjs';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import {
  TerminalCommandRequestService,
  xtermConsoleConfigOptions,
} from '@libs-terminal-util';
import { attachTerminalInput } from '../terminal-input';
import { PI_ZERO_PROMPT } from '@libs-web-serial-util';
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
  private static toXtermCrLf(text: string): string {
    return text.replace(/\r?\n/g, '\r\n');
  }

  /**
   * シリアル側のシェルプロンプト（サービス側の prompt 待機に渡す）
   */
  readonly remotePrompt = input<string>(PI_ZERO_PROMPT);

  @ViewChild('consoleDom', { read: ElementRef })
  private consoleDomRef?: ElementRef<HTMLElement>;

  private console = inject(TerminalConsoleOrchestrationService);
  private commandRequests = inject(TerminalCommandRequestService);
  private destroyRef = inject(DestroyRef);

  readonly xterminal = new Terminal(xtermConsoleConfigOptions);

  private readonly fitAddon = new FitAddon();

  private commandRequestSub?: Subscription;
  private resizeObserver?: ResizeObserver;

  /** キー入力可否（{@link TerminalConsoleOrchestrationService#isConnected$} のミラー） */
  private serialInputEnabled = false;

  ngAfterViewInit(): void {
    this.configTerminal();
    this.console.connectionEstablished$
      .pipe(
        switchMap(() =>
          this.console.isConnected$.pipe(
            take(1),
            switchMap((connected) =>
              connected
                ? this.console.bootstrapAfterConnect$(
                    '[コンソール] シリアルに接続しました。',
                    this.terminalSink,
                  )
                : EMPTY,
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
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
      });

    this.xterminal.reset();
    this.console.isConnected$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((connected) => {
        if (connected) {
          this.console
            .bootstrapAfterConnect$(
              '[コンソール] シリアル接続済み。',
              this.terminalSink,
            )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
        } else {
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
            this.xterminal.writeln(`$ ${cmd}`);
            if (result.status === 'error') {
              this.xterminal.writeln(`\r\nCommand failed: ${result.message}`);
              this.xterminal.write('$ ');
              return;
            }
            const out = result.output;
            if (out) {
              this.xterminal.write(TerminalViewComponent.toXtermCrLf(out));
            }
            this.xterminal.write('\r\n$ ');
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
}
