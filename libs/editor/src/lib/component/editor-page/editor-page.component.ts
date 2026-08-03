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
import { ConfirmDialogComponent, DialogService } from '@libs-dialogs';
import { ConsoleShellStore } from '@libs-shared';
import { SerialFacadeService } from '@libs-web-serial';
import type { editor } from 'monaco-editor';
import { firstValueFrom } from 'rxjs';
import { EditorDraft, EditorDraftService, EditorService } from '../../service';
import {
  EditorDraftResolveChoice,
  EditorDraftResolveDialogComponent,
} from '../editor-draft-resolve-dialog/editor-draft-resolve-dialog.component';
import { EditorToolbarComponent } from '../editor-toolbar/editor-toolbar.component';
import { FileNameDisplayComponent } from '../file-name-display/file-name-display.component';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';
import { EditorSaveStatus, isEditorDirtyStatus } from './editor-save-status';

export interface EditorLoadError {
  path: string;
  message: string;
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
  saveError = signal<string | null>(null);

  readonly isDirty = computed(() => isEditorDirtyStatus(this.saveStatus()));
  readonly isSaving = computed(() => this.saveStatus() === 'saving');
  readonly isLoading = computed(() => this.saveStatus() === 'loading');

  private editorService = inject(EditorService);
  private draftService = inject(EditorDraftService);
  private shellStore = inject(ConsoleShellStore);
  private dialog = inject(DialogService);
  private readonly serial = inject(SerialFacadeService);

  readonly isSerialConnected = this.serial.isConnected;
  private readonly activeFilePath = signal<string | null>(null);
  private baselineContent = '';
  private baselineReady = false;
  private initialized = false;
  private loadGeneration = 0;
  private ignoreNextSelection = false;
  private promptInFlight: Promise<boolean> | null = null;

  constructor() {
    effect(() => {
      const selectedPath = this.shellStore.selectedFilePath();
      if (!this.initialized || !selectedPath) {
        return;
      }
      if (this.ignoreNextSelection) {
        this.ignoreNextSelection = false;
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

  private currentFilePath(): string | null {
    return this.activeFilePath();
  }

  currentFileName(): string | null {
    const path = this.currentFilePath();
    if (!path) {
      return null;
    }
    return path.split('/').pop() ?? path;
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

    try {
      const loaded = await this.editorService.loadTextFile(path);
      if (generation !== this.loadGeneration) {
        return;
      }
      this.applyDeviceContent(path, loaded);
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to load file';
      this.loadError.set({ path, message });
      if (this.activeFilePath()) {
        this.saveStatus.set(previousStatus ?? 'savedToDevice');
      } else {
        this.saveStatus.set(null);
      }
    }
  }

  private applyDeviceContent(path: string, content: string): void {
    this.activeFilePath.set(path);
    this.code.set(content);
    this.baselineContent = content;
    this.baselineReady = true;
    this.saveStatus.set('savedToDevice');
    this.saveError.set(null);
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

    try {
      this.baselineContent = await this.editorService.loadTextFile(draft.path);
      this.baselineReady = true;
    } catch {
      this.baselineContent = '';
      this.baselineReady = false;
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
    try {
      await this.editorService.saveTextFile(path, this.code());
      this.baselineContent = this.code();
      this.baselineReady = true;
      this.saveStatus.set('savedToDevice');
      this.draftService.clear(path);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Save failed: unexpected error while writing to the device';
      this.saveError.set(message);
      // Keep editor content and local draft so the user can retry after reconnect.
      this.saveStatus.set('saveFailed');
    }
  }

  /** Wired to Format toolbar action; implementation lands with formatDocument. */
  async formatCurrentFile(): Promise<void> {
    return;
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
    if (!isSaveShortcut) return;

    event.preventDefault();
    await this.saveCurrentFile();
  }
}
