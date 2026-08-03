import {
  Component,
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
  isDirty = signal(false);
  isSaving = signal(false);
  isLoading = signal(false);
  loadError = signal<EditorLoadError | null>(null);

  private editorService = inject(EditorService);
  private draftService = inject(EditorDraftService);
  private shellStore = inject(ConsoleShellStore);
  private readonly activeFilePath = signal<string | null>(null);
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
      this.isDirty.set(true);
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
      !this.isLoading()
    ) {
      return;
    }

    const generation = ++this.loadGeneration;
    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      const loaded = await this.editorService.loadTextFile(path);
      if (generation !== this.loadGeneration) {
        return;
      }
      this.activeFilePath.set(path);
      this.code.set(loaded);
      this.isDirty.set(false);
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to load file';
      this.loadError.set({ path, message });
    } finally {
      if (generation === this.loadGeneration) {
        this.isLoading.set(false);
      }
    }
  }

  async saveCurrentFile(): Promise<void> {
    const path = this.currentFilePath();
    if (!path || !this.isDirty() || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    try {
      await this.editorService.saveTextFile(path, this.code());
      this.isDirty.set(false);
      this.draftService.clear(path);
    } finally {
      this.isSaving.set(false);
    }
  }

  onEditorInitialized(editorInstance: editor.IStandaloneCodeEditor): void {
    this.editorService.initializeEditor(editorInstance);
  }

  onCodeChange(code: string): void {
    this.code.set(code);
    const path = this.currentFilePath();
    if (this.isDirty() && path) {
      this.draftService.save(path, code);
    }
  }

  onContentEdited(): void {
    const path = this.currentFilePath();
    if (!path) {
      return;
    }
    this.isDirty.set(true);
    this.draftService.save(path, this.code());
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
