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
import { ConsoleShellStore } from '@libs-shared';
import type { editor } from 'monaco-editor';
import { EditorDraftService, EditorService } from '../../service';
import { EditorToolbarComponent } from '../editor-toolbar/editor-toolbar.component';
import { FileNameDisplayComponent } from '../file-name-display/file-name-display.component';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';
import {
  EditorSaveStatus,
  isEditorDirtyStatus,
} from './editor-save-status';

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
  private readonly activeFilePath = signal<string | null>(null);
  private baselineContent = '';
  private initialized = false;
  private loadGeneration = 0;

  constructor() {
    effect(() => {
      const selectedPath = this.shellStore.selectedFilePath();
      if (!this.initialized || !selectedPath) {
        return;
      }
      void this.loadFile(selectedPath);
    });
  }

  async ngOnInit(): Promise<void> {
    const selectedPath = this.shellStore.selectedFilePath();
    const draft =
      (selectedPath ? this.draftService.read(selectedPath) : null) ??
      this.draftService.list()[0] ??
      null;
    if (draft) {
      this.activeFilePath.set(draft.path);
      this.code.set(draft.content);
      this.baselineContent = '';
      this.saveStatus.set('draftSavedLocally');
      this.initialized = true;
      return;
    }

    if (selectedPath) {
      await this.loadFile(selectedPath);
    }
    this.initialized = true;
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

  private async loadFile(path: string): Promise<void> {
    if (
      path === this.activeFilePath() &&
      !this.loadError() &&
      this.saveStatus() !== 'loading'
    ) {
      return;
    }

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
    this.saveStatus.set('savedToDevice');
    this.saveError.set(null);
  }

  async saveCurrentFile(): Promise<void> {
    const path = this.currentFilePath();
    if (!path || !this.isDirty() || this.isSaving()) {
      return;
    }

    this.saveStatus.set('saving');
    this.saveError.set(null);
    try {
      await this.editorService.saveTextFile(path, this.code());
      this.baselineContent = this.code();
      this.saveStatus.set('savedToDevice');
      this.draftService.clear(path);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to save file';
      this.saveError.set(message);
      this.saveStatus.set('saveFailed');
    }
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
    if (!path || this.saveStatus() === 'loading' || this.saveStatus() === 'saving') {
      return;
    }

    if (code === this.baselineContent) {
      this.saveStatus.set('savedToDevice');
      this.saveError.set(null);
      this.draftService.clear(path);
      return;
    }

    this.saveStatus.set('unsavedChanges');
    this.draftService.save(path, code);
    this.saveStatus.set('draftSavedLocally');
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
