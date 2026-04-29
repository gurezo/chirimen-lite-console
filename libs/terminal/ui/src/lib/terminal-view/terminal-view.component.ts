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
import {
  EMPTY,
  Subscription,
  catchError,
  finalize,
  firstValueFrom,
  switchMap,
  take,
} from 'rxjs';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import {
  TerminalCommandRequestService,
  sanitizeSerialStdout,
  xtermConsoleConfigOptions,
} from '@libs-terminal-util';
import { attachTerminalInput } from '../terminal-input';
import {
  PiZeroSessionService,
  SerialFacadeService,
} from '@libs-web-serial-data-access';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial-util';

@Component({
  selector: 'choh-terminal-view',
  host: {
    class: 'block h-full min-h-0 min-w-0',
  },
  templateUrl: './terminal-view.component.html',
})
export class TerminalViewComponent implements AfterViewInit, OnDestroy {
  /**
   * シリアル側のシェルプロンプト（CommandService の prompt 待機に利用）
   */
  readonly remotePrompt = input<string>(PI_ZERO_PROMPT);

  @ViewChild('consoleDom', { read: ElementRef })
  private consoleDomRef?: ElementRef<HTMLElement>;

  private serial = inject(SerialFacadeService);
  private piZeroSession = inject(PiZeroSessionService);
  private commandRequests = inject(TerminalCommandRequestService);
  private destroyRef = inject(DestroyRef);

  readonly xterminal = new Terminal(xtermConsoleConfigOptions);

  private readonly fitAddon = new FitAddon();

  /** Serializes interactive and toolbar-initiated exec so only one runs at a time. */
  private execTail: Promise<void> = Promise.resolve();

  private commandRequestSub?: Subscription;
  private resizeObserver?: ResizeObserver;

  /** {@link SerialFacadeService#isConnected$} の直近値（キー入力可否用） */
  private serialInputEnabled = false;

  ngAfterViewInit(): void {
    this.configTerminal();
    this.serial.connectionEstablished$
      .pipe(
        switchMap(() =>
          this.serial.isConnected$.pipe(
            take(1),
            switchMap((connected) =>
              connected
                ? this.bootstrapAfterConnect$(
                    '[コンソール] シリアルに接続しました。',
                  )
                : EMPTY
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

  private enqueueExec<T>(job: () => Promise<T>): Promise<T> {
    const run = this.execTail.then(() => job());
    this.execTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private configTerminal(): void {
    const el = this.consoleDomRef?.nativeElement;
    if (!el) return;

    this.xterminal.loadAddon(this.fitAddon);
    this.xterminal.open(el);
    this.fitTerminal();
    this.resizeObserver = new ResizeObserver(() => this.fitTerminal());
    this.resizeObserver.observe(el);

    this.serial.isConnected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((c) => {
        this.serialInputEnabled = c;
      });

    this.xterminal.reset();
    this.serial.isConnected$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((connected) => {
        if (connected) {
          this.bootstrapAfterConnect$('[コンソール] シリアル接続済み。')
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
        } else {
          this.xterminal.writeln('$ ');
        }
      });

    attachTerminalInput(
      this.xterminal,
      async (command) => {
        return this.enqueueExec(async () => {
          const { stdout } = await firstValueFrom(this.serial.exec$(command, {
            prompt: this.remotePrompt(),
            timeout: SERIAL_TIMEOUT.DEFAULT,
          }));
          return sanitizeSerialStdout(stdout, command, this.remotePrompt());
        });
      },
      () => this.serialInputEnabled,
    );

    this.commandRequestSub = this.commandRequests.commandRequests$.subscribe(
      (cmd) => {
        void this.enqueueExec(async () => {
          const connected = await firstValueFrom(
            this.serial.isConnected$.pipe(take(1)),
          );
          if (!connected) {
            this.xterminal.writeln(`$ ${cmd}`);
            this.xterminal.writeln('Command failed: Serial port not connected');
            this.xterminal.write('$ ');
            return;
          }
          this.xterminal.writeln(`$ ${cmd}`);
          try {
            const { stdout } = await firstValueFrom(this.serial.exec$(cmd, {
              prompt: this.remotePrompt(),
              timeout: SERIAL_TIMEOUT.DEFAULT,
            }));
            const out = sanitizeSerialStdout(
              stdout,
              cmd,
              this.remotePrompt(),
            );
            if (out) {
              this.xterminal.write(out);
            }
            this.xterminal.write('\r\n$ ');
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : String(error);
            this.xterminal.writeln(`\r\nCommand failed: ${message}`);
            this.xterminal.write('$ ');
          }
        });
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

  private bootstrapAfterConnect$(prefixMessage: string) {
    return this.piZeroSession.bootstrap.shouldRunAfterConnect$().pipe(
      switchMap((should) => {
        if (!should) {
          this.xterminal.writeln(
            `${prefixMessage} 初期化済みのためスキップします。`,
          );
          this.xterminal.write('$ ');
          return EMPTY;
        }
        this.xterminal.writeln(`${prefixMessage} 初期化しています...`);
        return this.piZeroSession.bootstrap.runAfterConnect$((line) =>
          this.xterminal.writeln(line),
        );
      }),
      catchError(() => EMPTY),
      finalize(() => this.xterminal.write('$ ')),
    );
  }
}
