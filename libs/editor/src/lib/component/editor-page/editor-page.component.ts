import {
  Component,
  effect,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ConsoleShellStore } from '@libs-console-shell';
import type { editor } from 'monaco-editor';
import { EditorService } from '../../service';
import { EditorToolbarComponent } from '../editor-toolbar/editor-toolbar.component';
import { FileNameDisplayComponent } from '../file-name-display/file-name-display.component';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';

const DEFAULT_CODE = `
    onload = async function () {
      window.addEventListener("message", receiveMessage, false);
      portWritelnWaitfor = window.opener.portWritelnWaitfor;
      getOutputLines = function (inp) {
        var ret = window.opener.getOutputLines(inp);
        console.log(ret);
        return ret;
      };
      cmdPrompt = window.opener.cmdPrompt;
      mv = window.opener.mv;
      cp = window.opener.cp;
      showDir = window.opener.showDir;
    };
    const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec));
`;

@Component({
  selector: 'choh-editor-page',
  imports: [
    MonacoEditorComponent,
    EditorToolbarComponent,
    FileNameDisplayComponent,
  ],
  templateUrl: './editor-page.component.html',
})
export class EditorPageComponent implements OnInit {
  code = signal(DEFAULT_CODE.trim());
  isDirty = signal(false);
  isSaving = signal(false);

  private editorService = inject(EditorService);
  private shellStore = inject(ConsoleShellStore);
  private readonly defaultFilePath = '/home/pi/edited.js';

  constructor() {
    effect(() => {
      const selectedPath = this.shellStore.selectedFilePath();
      if (!selectedPath) {
        return;
      }
      void this.loadFile(selectedPath);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadFile(this.currentFilePath());
  }

  private currentFilePath(): string {
    return this.shellStore.selectedFilePath() ?? this.defaultFilePath;
  }

  currentFileName(): string {
    return this.currentFilePath().split('/').pop() ?? this.currentFilePath();
  }

  private async loadFile(path: string): Promise<void> {
    try {
      const loaded = await this.editorService.loadTextFile(path);
      this.code.set(loaded);
      this.isDirty.set(false);
    } catch {
      // ファイルが存在しない等の場合はデフォルトコードのまま
    }
  }

  async saveCurrentFile(): Promise<void> {
    if (!this.isDirty() || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    try {
      await this.editorService.saveTextFile(
        this.currentFilePath(),
        this.code(),
      );
      this.isDirty.set(false);
    } finally {
      this.isSaving.set(false);
    }
  }

  onEditorInitialized(editorInstance: editor.IStandaloneCodeEditor): void {
    this.editorService.initializeEditor(editorInstance);
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
