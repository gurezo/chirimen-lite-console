import {
  Component,
  computed,
  effect,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import {
  ConfirmDialogComponent,
  DialogService,
  ProgressDialogComponent,
  type ProgressDialogData,
} from '@libs-dialogs';
import {
  FileNameDialogComponent,
  FileService,
  joinPath,
} from '@libs-file-manager';
import { ConsoleShellStore, NotificationService } from '@libs-shared';
import {
  DEFAULT_NEW_TEXT_FILE_META,
  EDITOR_FILE_MAX_BYTES,
  EDITOR_FILE_WARN_BYTES,
  FileUtils,
  isNonUtf8TextError,
  SerialConnectionViewModelFacade,
  type TextFileMeta,
} from '@libs-web-serial';
import type { editor } from 'monaco-editor';
import { firstValueFrom } from 'rxjs';
import { resolveEditorLanguage } from '../../functions';
import { EditorDraft, EditorDraftService, EditorService } from '../../service';
import {
  EditorDraftResolveChoice,
  EditorDraftResolveDialogComponent,
} from '../editor-draft-resolve-dialog/editor-draft-resolve-dialog.component';
import { EditorToolbarComponent } from '../editor-toolbar/editor-toolbar.component';
import { FileNameDisplayComponent } from '../file-name-display/file-name-display.component';
import {
  MonacoEditorComponent,
  MonacoEditorOptions,
} from '../monaco-editor/monaco-editor.component';
import { EditorSaveStatus, isEditorDirtyStatus } from './editor-save-status';

export interface EditorLoadError {
  path: string;
  /** User-facing summary (not color-only). */
  message: string;
  /** Technical detail shown in an expandable section. */
  detail: string;
}

export interface EditorSaveError {
  message: string;
  detail: string;
}

@Component({
  selector: 'choh-editor-page',
  imports: [
    MonacoEditorComponent,
    EditorToolbarComponent,
    FileNameDisplayComponent,
    MatProgressSpinner,
  ],
  templateUrl: './editor-page.component.html',
})
export class EditorPageComponent implements OnInit {
  code = signal('');
  saveStatus = signal<EditorSaveStatus | null>(null);
  loadError = signal<EditorLoadError | null>(null);
  saveError = signal<EditorSaveError | null>(null);
  lastDeviceSavedAt = signal<number | null>(null);
  isReadOnly = signal(false);

  readonly isDirty = computed(() => isEditorDirtyStatus(this.saveStatus()));
  readonly isSaving = computed(() => this.saveStatus() === 'saving');
  readonly isLoading = computed(() => this.saveStatus() === 'loading');

  readonly languageInfo = computed(() =>
    resolveEditorLanguage(this.activeFilePath()),
  );

  readonly languageLabel = computed(() => {
    if (!this.activeFilePath()) {
      return null;
    }
    return this.languageInfo().label;
  });

  readonly monacoOptions = computed<MonacoEditorOptions>(() => ({
    theme: 'vs-dark',
    language: this.languageInfo().monacoLanguage,
    automaticLayout: true,
    readOnly: this.isReadOnly(),
  }));

  private editorService = inject(EditorService);
  private draftService = inject(EditorDraftService);
  private shellStore = inject(ConsoleShellStore);
  private dialog = inject(DialogService);
  private readonly fileService = inject(FileService);
  private readonly connectionVm = inject(SerialConnectionViewModelFacade);
  private readonly notify = inject(NotificationService);

  readonly connection = this.connectionVm.vm;
  readonly isSerialConnected = computed(() => this.connection().isConnected);
  readonly isConnecting = computed(
    () =>
      this.connection().isConnecting || this.connection().isInitializing,
  );
  private readonly activeFilePath = signal<string | null>(null);
  private baselineContent = '';
  private baselineReady = false;
  private textFileMeta: TextFileMeta = { ...DEFAULT_NEW_TEXT_FILE_META };
  private initialized = false;
  private loadGeneration = 0;
  private ignoreNextSelection = false;
  private promptInFlight: Promise<boolean> | null = null;
  private transferAbortGeneration = 0;

  constructor() {
    effect(() => {
      const selectedPath = this.shellStore.selectedFilePath();
      if (!this.initialized) {
        return;
      }
      if (!selectedPath) {
        if (this.activeFilePath()) {
          this.clearOpenFile();
        }
        return;
      }
      if (this.ignoreNextSelection) {
        this.ignoreNextSelection = false;
        return;
      }
      if (this.tryRetargetAfterRename(selectedPath)) {
        return;
      }
      void this.loadFile(selectedPath);
    });
  }

  async ngOnInit(): Promise<void> {
    const selectedPath = this.shellStore.selectedFilePath();
    const draft =
      (selectedPath ? this.draftService.read(selectedPath) : null) ??
      this.latestDraft() ??
      null;

    if (draft) {
      this.shellStore.setSelectedFilePath(draft.path);
      await this.resolveDraft(draft);
      this.initialized = true;
      return;
    }

    if (selectedPath) {
      await this.loadFile(selectedPath, { skipDirtyCheck: true });
    }
    this.initialized = true;
  }

  private latestDraft(): EditorDraft | null {
    const drafts = this.draftService.list();
    if (drafts.length === 0) {
      return null;
    }
    return drafts.reduce((latest, draft) =>
      draft.updatedAt > latest.updatedAt ? draft : latest,
    );
  }

  currentFilePath(): string | null {
    return this.activeFilePath();
  }

  currentFileName(): string | null {
    const path = this.currentFilePath();
    if (!path) {
      return null;
    }
    return path.split('/').pop() ?? path;
  }

  /**
   * After a tree rename, the draft key is moved first and selection updates to
   * the new path. Keep editor content and only retarget the open path.
   */
  private tryRetargetAfterRename(selectedPath: string): boolean {
    const previousPath = this.activeFilePath();
    if (!previousPath || previousPath === selectedPath) {
      return false;
    }
    if (this.draftService.has(previousPath)) {
      return false;
    }
    const draft = this.draftService.read(selectedPath);
    if (!draft || draft.content !== this.code()) {
      return false;
    }
    this.activeFilePath.set(selectedPath);
    this.loadError.set(null);
    return true;
  }

  private clearOpenFile(): void {
    this.loadGeneration += 1;
    this.activeFilePath.set(null);
    this.code.set('');
    this.baselineContent = '';
    this.baselineReady = false;
    this.textFileMeta = { ...DEFAULT_NEW_TEXT_FILE_META };
    this.saveStatus.set(null);
    this.loadError.set(null);
    this.saveError.set(null);
    this.lastDeviceSavedAt.set(null);
    this.isReadOnly.set(false);
  }

  private async loadFile(
    path: string,
    options?: { skipDirtyCheck?: boolean; forceDevice?: boolean },
  ): Promise<void> {
    if (
      path === this.activeFilePath() &&
      !this.loadError() &&
      this.saveStatus() !== 'loading' &&
      !options?.forceDevice
    ) {
      return;
    }

    if (
      !options?.skipDirtyCheck &&
      this.isDirty() &&
      path !== this.activeFilePath()
    ) {
      const confirmed = await this.confirmLeaveUnsaved(
        'You have unsaved changes. Discard them and open the other file?',
      );
      if (!confirmed) {
        this.revertSelection();
        return;
      }
      const currentPath = this.activeFilePath();
      if (currentPath) {
        this.draftService.clear(currentPath);
      }
    }

    if (!options?.forceDevice) {
      const draft = this.draftService.read(path);
      if (draft && path !== this.activeFilePath()) {
        await this.resolveDraft(draft);
        return;
      }
    }

    await this.fetchDeviceFile(path);
  }

  private async fetchDeviceFile(path: string): Promise<void> {
    const generation = ++this.loadGeneration;
    const previousStatus = this.saveStatus();
    this.saveStatus.set('loading');
    this.loadError.set(null);
    this.saveError.set(null);
    this.lastDeviceSavedAt.set(null);
    this.isReadOnly.set(false);

    try {
      const byteSize = await this.editorService.getByteSize(path);
      if (generation !== this.loadGeneration) {
        return;
      }

      if (byteSize > EDITOR_FILE_MAX_BYTES) {
        this.notify.error(
          '読込失敗',
          `ファイルが大きすぎます（上限 ${FileUtils.formatFileSize(EDITOR_FILE_MAX_BYTES)}）。`,
        );
        this.loadError.set({
          path,
          message: `ファイルが大きすぎるため開けません: ${path}`,
          detail: `size=${byteSize} max=${EDITOR_FILE_MAX_BYTES}`,
        });
        this.restoreStatusAfterFailedLoad(previousStatus);
        return;
      }

      if (byteSize >= EDITOR_FILE_WARN_BYTES) {
        const proceed = await this.confirmLargeFileOpen(byteSize);
        if (generation !== this.loadGeneration) {
          return;
        }
        if (!proceed) {
          this.restoreStatusAfterFailedLoad(previousStatus);
          if (!this.activeFilePath()) {
            this.revertSelection();
          }
          return;
        }
      }

      const showProgress = byteSize >= EDITOR_FILE_WARN_BYTES;
      const loaded = showProgress
        ? await this.loadTextFileWithProgress(path, generation)
        : await this.editorService.loadTextFile(path);

      if (generation !== this.loadGeneration || loaded === null) {
        return;
      }
      this.applyDeviceContent(path, loaded.content, loaded.meta);
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }
      if (isNonUtf8TextError(error)) {
        this.notify.error(
          '読込失敗',
          'UTF-8 ではないためファイルを開けません。',
        );
        this.loadError.set({
          path,
          message: `UTF-8 ではないため開けません: ${path}`,
          detail: error instanceof Error ? error.message : 'NON_UTF8_TEXT',
        });
        this.restoreStatusAfterFailedLoad(previousStatus);
        return;
      }
      const detail =
        error instanceof Error ? error.message : 'Failed to load file';
      this.loadError.set({
        path,
        message: `ファイルの読み込みに失敗しました: ${path}`,
        detail,
      });
      this.notify.error('読込失敗', `ファイルの読み込みに失敗しました: ${path}`);
      this.restoreStatusAfterFailedLoad(previousStatus);
    }
  }

  private restoreStatusAfterFailedLoad(
    previousStatus: EditorSaveStatus | null,
  ): void {
    if (this.activeFilePath()) {
      this.saveStatus.set(previousStatus ?? 'savedToDevice');
    } else {
      this.saveStatus.set(null);
    }
  }

  private async confirmLargeFileOpen(byteSize: number): Promise<boolean> {
    const sizeLabel = FileUtils.formatFileSize(byteSize);
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: '大きなファイル',
        message: `このファイルは ${sizeLabel} あります。読み込みに時間がかかる可能性があります。開きますか？`,
        confirmLabel: '開く',
        cancelLabel: 'キャンセル',
      },
    });
    return (await firstValueFrom(ref.closed)) === true;
  }

  private async loadTextFileWithProgress(
    path: string,
    generation: number,
  ): Promise<{ content: string; meta: TextFileMeta; size: number } | null> {
    const progress = signal(0);
    const data: ProgressDialogData = {
      message: `読み込み中…\n${path}`,
      progress,
      cancelLabel: 'キャンセル',
    };
    const ref = this.dialog.open(ProgressDialogComponent, {
      width: '400px',
      data,
      disableClose: true,
    });

    const abortGeneration = ++this.transferAbortGeneration;
    const cancelSub = ref.closed.subscribe((result) => {
      if (
        result === 'cancelled' &&
        abortGeneration === this.transferAbortGeneration &&
        generation === this.loadGeneration
      ) {
        this.editorService.cancelTransfer();
      }
    });

    progress.set(10);
    try {
      progress.set(40);
      const loaded = await this.editorService.loadTextFile(path);
      progress.set(100);
      ref.close();
      return loaded;
    } catch (error: unknown) {
      ref.close();
      const cancelled =
        error instanceof Error && isUserCancelledTransfer(error.message);
      if (cancelled) {
        this.notify.warning('読込キャンセル', 'ファイルの読み込みを中止しました');
        this.restoreStatusAfterFailedLoad(null);
        return null;
      }
      throw error;
    } finally {
      cancelSub.unsubscribe();
    }
  }

  private async saveTextFileWithProgress(
    path: string,
    content: string,
    meta: TextFileMeta,
  ): Promise<void> {
    const progress = signal(0);
    const data: ProgressDialogData = {
      message: `保存中…\n${path}`,
      progress,
      cancelLabel: 'キャンセル',
    };
    const ref = this.dialog.open(ProgressDialogComponent, {
      width: '400px',
      data,
      disableClose: true,
    });

    const abortGeneration = ++this.transferAbortGeneration;
    const cancelSub = ref.closed.subscribe((result) => {
      if (
        result === 'cancelled' &&
        abortGeneration === this.transferAbortGeneration
      ) {
        this.editorService.cancelTransfer();
      }
    });

    try {
      await this.editorService.saveTextFile(path, content, meta, {
        onProgress: (percent) => progress.set(percent),
      });
      progress.set(100);
      ref.close();
    } catch (error: unknown) {
      ref.close();
      throw error;
    } finally {
      cancelSub.unsubscribe();
    }
  }

  async retryLoadCurrentFile(): Promise<void> {
    const path = this.loadError()?.path ?? this.activeFilePath();
    if (!path || !this.isSerialConnected() || this.isLoading()) {
      return;
    }
    await this.fetchDeviceFile(path);
  }

  private applyDeviceContent(
    path: string,
    content: string,
    meta: TextFileMeta,
  ): void {
    this.activeFilePath.set(path);
    this.code.set(content);
    this.baselineContent = content;
    this.baselineReady = true;
    this.textFileMeta = { ...meta };
    this.saveStatus.set('savedToDevice');
    this.saveError.set(null);
    this.lastDeviceSavedAt.set(null);
    this.isReadOnly.set(false);
    this.editorService.applyLineEnding(meta.lineEnding);
  }

  private async resolveDraft(draft: EditorDraft): Promise<void> {
    const choice = await this.openDraftResolveDialog(draft.path);
    switch (choice) {
      case 'restore':
        await this.restoreDraft(draft);
        break;
      case 'discard':
      case 'reload':
        this.draftService.clear(draft.path);
        await this.fetchDeviceFile(draft.path);
        break;
      default:
        this.draftService.clear(draft.path);
        await this.fetchDeviceFile(draft.path);
        break;
    }
  }

  private async restoreDraft(draft: EditorDraft): Promise<void> {
    this.activeFilePath.set(draft.path);
    this.code.set(draft.content);
    this.saveStatus.set('draftSavedLocally');
    this.saveError.set(null);
    this.loadError.set(null);
    this.lastDeviceSavedAt.set(null);
    this.isReadOnly.set(false);

    try {
      const loaded = await this.editorService.loadTextFile(draft.path);
      this.baselineContent = loaded.content;
      this.baselineReady = true;
      this.textFileMeta = { ...loaded.meta };
      this.editorService.applyLineEnding(loaded.meta.lineEnding);
    } catch {
      this.baselineContent = '';
      this.baselineReady = false;
      this.textFileMeta = { ...DEFAULT_NEW_TEXT_FILE_META };
    }
  }

  private async openDraftResolveDialog(
    path: string,
  ): Promise<EditorDraftResolveChoice | null> {
    const ref = this.dialog.open(EditorDraftResolveDialogComponent, {
      width: '420px',
      data: { path },
      disableClose: true,
    });
    const result = await firstValueFrom(ref.closed);
    return result === 'restore' || result === 'discard' || result === 'reload'
      ? result
      : null;
  }

  private async confirmLeaveUnsaved(
    message: string,
    confirmLabel = 'Discard',
  ): Promise<boolean> {
    if (this.promptInFlight) {
      return this.promptInFlight;
    }
    this.promptInFlight = (async () => {
      const ref = this.dialog.open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: 'Unsaved changes',
          message,
          confirmLabel,
          cancelLabel: 'Cancel',
        },
      });
      return (await firstValueFrom(ref.closed)) === true;
    })();
    try {
      return await this.promptInFlight;
    } finally {
      this.promptInFlight = null;
    }
  }

  private revertSelection(): void {
    this.ignoreNextSelection = true;
    this.shellStore.setSelectedFilePath(this.activeFilePath());
  }

  async createNewFile(): Promise<void> {
    if (!this.isSerialConnected() || this.isSaving() || this.isLoading()) {
      return;
    }

    const parent = this.shellStore.fileManagerCurrentPath();
    const ref = this.dialog.open(FileNameDialogComponent, {
      width: '360px',
      data: {
        title: '新規ファイル',
        confirmLabel: '作成',
        label: 'ファイル名',
        description: `作成先: ${parent}`,
      },
    });
    const result = await firstValueFrom(ref.closed);
    if (typeof result !== 'string' || !result) {
      return;
    }

    const path = joinPath(parent, result);
    try {
      if (await this.fileService.exists(path)) {
        this.notify.error('New File', `「${result}」は既に存在します`);
        return;
      }
      await this.fileService.touch(path);
      this.shellStore.setSelectedFilePath(path);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to create file';
      this.notify.error('New File', message);
    }
  }

  async saveCurrentFile(): Promise<void> {
    const path = this.currentFilePath();
    if (
      !path ||
      !this.isDirty() ||
      this.isSaving() ||
      !this.isSerialConnected()
    ) {
      return;
    }

    this.saveStatus.set('saving');
    this.saveError.set(null);

    const meta = this.textFileMeta;
    const content = this.code();
    const estimatedBytes = new TextEncoder().encode(
      // rough size for progress UI decision; exact payload may differ slightly
      content,
    ).byteLength;
    const showProgress =
      estimatedBytes > FileUtils.TEXT_CHUNK_THRESHOLD_BYTES ||
      estimatedBytes >= EDITOR_FILE_WARN_BYTES;

    try {
      if (showProgress) {
        await this.saveTextFileWithProgress(path, content, meta);
      } else {
        await this.editorService.saveTextFile(path, content, meta);
      }
      this.baselineContent = content;
      this.baselineReady = true;
      this.lastDeviceSavedAt.set(Date.now());
      this.isReadOnly.set(false);
      this.saveStatus.set('savedToDevice');
      this.draftService.clear(path);
      this.notify.success('保存成功', 'デバイスへ保存しました');
    } catch (error: unknown) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Save failed: unexpected error while writing to the device';
      if (isUserCancelledTransfer(detail)) {
        this.saveStatus.set('draftSavedLocally');
        this.notify.warning('保存キャンセル', '保存を中止しました。Draft は保持されています。');
        return;
      }
      this.saveError.set({
        message: 'デバイスへの保存に失敗しました。内容は Editor / Draft に保持されています。',
        detail,
      });
      // Keep editor content and local draft so the user can retry after reconnect.
      this.saveStatus.set('saveFailed');
      this.notify.error('保存失敗', 'デバイスへの保存に失敗しました');
      if (isWritePermissionDenied(detail)) {
        this.isReadOnly.set(true);
      }
    }
  }

  async formatCurrentFile(): Promise<void> {
    if (
      !this.currentFilePath() ||
      this.isLoading() ||
      this.isSaving() ||
      !this.isSerialConnected()
    ) {
      return;
    }

    const formatted = await this.editorService.formatDocument();
    if (!formatted) {
      this.notify.warning(
        'フォーマット',
        'この言語向けのフォーマッターはありません。',
      );
      return;
    }

    const value = this.editorService.getValue();
    if (value !== null) {
      this.onCodeChange(value);
    }
  }

  async discardChanges(): Promise<void> {
    const path = this.currentFilePath();
    if (!path || !this.isDirty()) {
      return;
    }

    const confirmed = await this.confirmLeaveUnsaved(
      'Discard local changes and restore the last loaded device content?',
    );
    if (!confirmed) {
      return;
    }

    this.draftService.clear(path);
    if (this.baselineReady) {
      this.code.set(this.baselineContent);
      this.saveStatus.set('savedToDevice');
      this.saveError.set(null);
      return;
    }

    await this.fetchDeviceFile(path);
  }

  async canDeactivate(): Promise<boolean> {
    if (!this.isDirty()) {
      return true;
    }
    return this.confirmLeaveUnsaved(
      'You have unsaved changes. Leave the editor? Your local draft will be kept in this browser tab.',
      'Leave',
    );
  }

  onEditorInitialized(editorInstance: editor.IStandaloneCodeEditor): void {
    this.editorService.initializeEditor(editorInstance);
  }

  onCodeChange(code: string): void {
    this.code.set(code);
    this.syncDirtyStateFromCode(code);
  }

  onContentEdited(): void {
    this.syncDirtyStateFromCode(this.code());
  }

  private syncDirtyStateFromCode(code: string): void {
    const path = this.currentFilePath();
    if (
      !path ||
      this.saveStatus() === 'loading' ||
      this.saveStatus() === 'saving'
    ) {
      return;
    }

    if (this.baselineReady && code === this.baselineContent) {
      this.saveStatus.set('savedToDevice');
      this.saveError.set(null);
      this.draftService.clear(path);
      return;
    }

    this.saveStatus.set('unsavedChanges');
    this.draftService.save(path, code);
    this.saveStatus.set('draftSavedLocally');
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.isDirty()) {
      return;
    }
    event.preventDefault();
    event.returnValue = true;
  }

  @HostListener('window:keydown', ['$event'])
  async onKeydown(event: KeyboardEvent): Promise<void> {
    const isSaveShortcut =
      (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
    if (isSaveShortcut) {
      event.preventDefault();
      await this.saveCurrentFile();
      return;
    }

    const isFormatShortcut =
      event.shiftKey &&
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.key.toLowerCase() === 'f';
    if (!isFormatShortcut) {
      return;
    }

    event.preventDefault();
    await this.formatCurrentFile();
  }
}

function isWritePermissionDenied(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('write permission was denied') ||
    lower.includes('permission denied')
  );
}

/** User clicked Cancel on the progress dialog (not serial disconnect). */
function isUserCancelledTransfer(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('all commands cancelled') ||
    lower === 'cancelled' ||
    lower.includes('transfer cancelled')
  );
}
