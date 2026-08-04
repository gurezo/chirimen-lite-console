/// <reference types="vitest/globals" />
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DialogService } from '@libs-dialogs';
import type { SerialConnectionViewModel } from '@libs-web-serial';
import { SerialConnectionViewModelFacade } from '@libs-web-serial';
import { of } from 'rxjs';
import { FileTreeNode } from '../../models';
import { FileService } from '../../service';
import { FileContextMenuComponent } from '../file-context-menu/file-context-menu.component';
import { FileTreeFeatureComponent } from './file-tree-feature.component';

describe('FileTreeFeatureComponent', () => {
  const listTreeMock = vi.fn<() => Promise<FileTreeNode[]>>();
  const touchMock = vi.fn<() => Promise<void>>();
  const mkdirMock = vi.fn<() => Promise<void>>();
  const moveMock = vi.fn<() => Promise<void>>();
  const moveIntoDirectoryMock =
    vi.fn<() => Promise<{ from: string; to: string } | null>>();
  const removeMock = vi.fn<() => Promise<void>>();
  const existsMock = vi.fn<() => Promise<boolean>>();
  const hasUnsavedDraftMock = vi.fn<(path: string) => boolean>();
  const dialogOpen = vi.fn();
  let vmSignal: ReturnType<typeof signal<SerialConnectionViewModel>>;

  const treeNodes: FileTreeNode[] = [
    { name: 'docs', path: './docs', isDirectory: true },
    { name: 'main.ts', path: './main.ts', isDirectory: false },
  ];

  const baseVm: SerialConnectionViewModel = {
    isBrowserSupported: true,
    isConnected: false,
    isConnecting: false,
    isLoggedIn: false,
    isInitializing: false,
    setupStatus: 'idle',
    errorMessage: null,
  };

  async function compileAndCreate(): Promise<
    ComponentFixture<FileTreeFeatureComponent>
  > {
    vmSignal = signal<SerialConnectionViewModel>({ ...baseVm });

    await TestBed.configureTestingModule({
      imports: [FileTreeFeatureComponent, NoopAnimationsModule],
      providers: [
        {
          provide: FileService,
          useValue: {
            listTree: listTreeMock,
            touch: touchMock,
            mkdir: mkdirMock,
            move: moveMock,
            moveIntoDirectory: moveIntoDirectoryMock,
            remove: removeMock,
            exists: existsMock,
          },
        },
        {
          provide: SerialConnectionViewModelFacade,
          useValue: { vm: computed(() => vmSignal()) },
        },
        {
          provide: DialogService,
          useValue: { open: dialogOpen },
        },
      ],
    }).compileComponents();

    return TestBed.createComponent(FileTreeFeatureComponent);
  }

  async function connectReady(
    fixture: ComponentFixture<FileTreeFeatureComponent>,
  ): Promise<void> {
    fixture.detectChanges();
    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: true,
      setupStatus: 'ready',
    });
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('.');
    });
    fixture.componentInstance.contextTarget = treeNodes[0];
    fixture.detectChanges();
  }

  beforeEach(() => {
    listTreeMock.mockReset();
    listTreeMock.mockResolvedValue(treeNodes);
    touchMock.mockReset();
    touchMock.mockResolvedValue(undefined);
    mkdirMock.mockReset();
    mkdirMock.mockResolvedValue(undefined);
    moveMock.mockReset();
    moveMock.mockResolvedValue(undefined);
    moveIntoDirectoryMock.mockReset();
    moveIntoDirectoryMock.mockImplementation(
      async (sourcePath: string, targetDirectoryPath: string) => {
        const name = sourcePath.split('/').filter(Boolean).pop() ?? sourcePath;
        const destination =
          targetDirectoryPath === '.'
            ? `./${name}`
            : `${targetDirectoryPath}/${name}`;
        if (destination === sourcePath || sourcePath === targetDirectoryPath) {
          return null;
        }
        if (await existsMock(destination)) {
          throw new Error(`「${name}」は既に存在します`);
        }
        await moveMock(sourcePath, destination);
        return { from: sourcePath, to: destination };
      },
    );
    removeMock.mockReset();
    removeMock.mockResolvedValue(undefined);
    existsMock.mockReset();
    existsMock.mockResolvedValue(false);
    hasUnsavedDraftMock.mockReset();
    hasUnsavedDraftMock.mockReturnValue(false);
    dialogOpen.mockReset();
  });

  afterEach(() => {
    void TestBed.resetTestingModule();
  });

  it('should create', async () => {
    const fixture = await compileAndCreate();
    expect(fixture.componentInstance).toBeTruthy();
    await fixture.whenStable();
  });

  it('defers listTree until bootstrap reaches setting-timezone', async () => {
    const fixture = await compileAndCreate();
    fixture.detectChanges();

    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: false,
      setupStatus: 'waiting-login',
    });
    await fixture.whenStable();

    expect(listTreeMock).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('mat-progress-spinner'),
    ).toBeTruthy();

    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: true,
      setupStatus: 'waiting-login',
    });
    TestBed.flushEffects();
    await fixture.whenStable();
    expect(listTreeMock).not.toHaveBeenCalled();

    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: true,
      setupStatus: 'setting-timezone',
    });
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('.');
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.nodes.length).toBe(2);
  });

  it('loads nodes when already logged in on connect', async () => {
    const fixture = await compileAndCreate();
    fixture.detectChanges();

    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: true,
      setupStatus: 'ready',
    });
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('.');
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.nodes.length).toBe(2);
  });

  it('emits currentPathChange and reloads when a directory is selected', async () => {
    const fixture = await compileAndCreate();
    fixture.detectChanges();
    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: true,
      setupStatus: 'ready',
    });
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('.');
    });

    const emitSpy = vi.spyOn(
      fixture.componentInstance.currentPathChange,
      'emit',
    );
    listTreeMock.mockClear();

    await fixture.componentInstance.onDirectorySelected({
      name: 'docs',
      path: './docs',
      isDirectory: true,
    });

    expect(emitSpy).toHaveBeenCalledWith('./docs');
    expect(listTreeMock).toHaveBeenCalledWith('./docs');
  });

  it('reloads when currentPath input changes after initial load', async () => {
    const fixture = await compileAndCreate();
    fixture.detectChanges();
    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: true,
      setupStatus: 'ready',
    });
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('.');
    });

    listTreeMock.mockClear();
    fixture.componentRef.setInput('currentPath', './docs');
    fixture.detectChanges();
    TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('./docs');
    });
  });

  it('does not skip initial load when setupStatus advances to ready', async () => {
    const fixture = await compileAndCreate();
    fixture.detectChanges();

    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: true,
      setupStatus: 'setting-timezone',
    });
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledTimes(1);
    });

    listTreeMock.mockClear();
    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: true,
      setupStatus: 'ready',
    });
    TestBed.flushEffects();
    await fixture.whenStable();

    expect(listTreeMock).not.toHaveBeenCalled();
    expect(fixture.componentInstance.nodes.length).toBe(2);
  });

  it('does not open context menu when disconnected', async () => {
    const fixture = await compileAndCreate();
    fixture.detectChanges();
    const menuDe = fixture.debugElement.query(
      By.directive(FileContextMenuComponent),
    );
    const openAt = vi.spyOn(
      menuDe.componentInstance as FileContextMenuComponent,
      'openAt',
    );

    fixture.componentInstance.onNodeContextMenu({
      node: treeNodes[0],
      event: new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 1,
        clientY: 2,
      }),
    });

    expect(openAt).not.toHaveBeenCalled();
    expect(fixture.componentInstance.contextTarget).toBeNull();
  });

  it('opens context menu when connected', async () => {
    const fixture = await compileAndCreate();
    await connectReady(fixture);

    const menuDe = fixture.debugElement.query(
      By.directive(FileContextMenuComponent),
    );
    const openAt = vi.spyOn(
      menuDe.componentInstance as FileContextMenuComponent,
      'openAt',
    );

    fixture.componentInstance.onNodeContextMenu({
      node: treeNodes[1],
      event: new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 20,
      }),
    });

    expect(fixture.componentInstance.contextTarget).toEqual(treeNodes[1]);
    expect(openAt).toHaveBeenCalledWith(10, 20);
  });

  it('creates a file inside a directory and navigates into it', async () => {
    dialogOpen.mockReturnValue({ closed: of('new.txt') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    const emitSpy = vi.spyOn(
      fixture.componentInstance.currentPathChange,
      'emit',
    );
    listTreeMock.mockClear();

    fixture.componentInstance.onMenuAction('new-file');
    await vi.waitFor(() => {
      expect(touchMock).toHaveBeenCalledWith('./docs/new.txt');
    });
    expect(emitSpy).toHaveBeenCalledWith('./docs');
    expect(listTreeMock).toHaveBeenCalledWith('./docs');
    expect(fixture.componentInstance.operationBusy).toBe(false);
  });

  it('creates a file in the current path when target is a file', async () => {
    dialogOpen.mockReturnValue({ closed: of('sibling.txt') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.componentInstance.contextTarget = treeNodes[1];
    listTreeMock.mockClear();

    fixture.componentInstance.onMenuAction('new-file');
    await vi.waitFor(() => {
      expect(touchMock).toHaveBeenCalledWith('./sibling.txt');
    });
    expect(listTreeMock).toHaveBeenCalledWith('.');
  });

  it('creates a file in the current path from background menu', async () => {
    dialogOpen.mockReturnValue({ closed: of('root.txt') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.componentInstance.onBackgroundContextMenu(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 3,
        clientY: 4,
      }),
    );
    expect(fixture.componentInstance.contextTarget?.virtual).toBe(true);
    listTreeMock.mockClear();

    fixture.componentInstance.onMenuAction('new-file');
    await vi.waitFor(() => {
      expect(touchMock).toHaveBeenCalledWith('./root.txt');
    });
    expect(listTreeMock).toHaveBeenCalledWith('.');
  });

  it('does not create a file when name dialog is cancelled', async () => {
    dialogOpen.mockReturnValue({ closed: of(null) });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    listTreeMock.mockClear();

    fixture.componentInstance.onMenuAction('new-file');
    await fixture.whenStable();

    expect(touchMock).not.toHaveBeenCalled();
    expect(listTreeMock).not.toHaveBeenCalled();
  });

  it('creates a directory inside a folder and navigates into it', async () => {
    dialogOpen.mockReturnValue({ closed: of('src') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);

    fixture.componentInstance.onMenuAction('new-directory');
    await vi.waitFor(() => {
      expect(mkdirMock).toHaveBeenCalledWith('./docs/src');
    });
    expect(listTreeMock).toHaveBeenCalledWith('./docs');
  });

  it('renames a node from context menu action', async () => {
    dialogOpen.mockReturnValue({ closed: of('app.ts') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.componentInstance.contextTarget = treeNodes[1];

    fixture.componentInstance.onMenuAction('rename');
    await vi.waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith('./main.ts', './app.ts');
    });
  });

  it('does not create a file when the path already exists', async () => {
    dialogOpen.mockReturnValue({ closed: of('main.ts') });
    existsMock.mockResolvedValue(true);
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.componentInstance.contextTarget = treeNodes[1];

    fixture.componentInstance.onMenuAction('new-file');
    await vi.waitFor(() => {
      expect(fixture.componentInstance.errorMessage).toBe(
        '「main.ts」は既に存在します',
      );
    });
    expect(touchMock).not.toHaveBeenCalled();
  });

  it('does not rename when the destination already exists', async () => {
    dialogOpen.mockReturnValue({ closed: of('docs') });
    existsMock.mockResolvedValue(true);
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.componentInstance.contextTarget = treeNodes[1];

    fixture.componentInstance.onMenuAction('rename');
    await vi.waitFor(() => {
      expect(fixture.componentInstance.errorMessage).toBe(
        '「docs」は既に存在します',
      );
    });
    expect(moveMock).not.toHaveBeenCalled();
  });

  it('emits fileCreated after creating a file', async () => {
    dialogOpen.mockReturnValue({ closed: of('root.txt') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.componentInstance.onBackgroundContextMenu(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 3,
        clientY: 4,
      }),
    );
    const createdSpy = vi.spyOn(fixture.componentInstance.fileCreated, 'emit');

    fixture.componentInstance.onMenuAction('new-file');
    await vi.waitFor(() => {
      expect(createdSpy).toHaveBeenCalledWith('./root.txt');
    });
  });

  it('emits fileRenamed after renaming a node', async () => {
    dialogOpen.mockReturnValue({ closed: of('app.ts') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.componentInstance.contextTarget = treeNodes[1];
    const renamedSpy = vi.spyOn(fixture.componentInstance.fileRenamed, 'emit');

    fixture.componentInstance.onMenuAction('rename');
    await vi.waitFor(() => {
      expect(renamedSpy).toHaveBeenCalledWith({
        from: './main.ts',
        to: './app.ts',
      });
    });
  });

  it('moves a node when dropped onto a directory', async () => {
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    const renamedSpy = vi.spyOn(fixture.componentInstance.fileRenamed, 'emit');

    fixture.componentInstance.onNodeDropped({
      source: treeNodes[1],
      targetDirectory: treeNodes[0],
    });

    await vi.waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith('./main.ts', './docs/main.ts');
    });
    expect(renamedSpy).toHaveBeenCalledWith({
      from: './main.ts',
      to: './docs/main.ts',
    });
  });

  it('moves a path via moveDroppedPath for external drop targets', async () => {
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    const renamedSpy = vi.spyOn(fixture.componentInstance.fileRenamed, 'emit');

    fixture.componentInstance.moveDroppedPath('./main.ts', './docs');

    await vi.waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith('./main.ts', './docs/main.ts');
    });
    expect(renamedSpy).toHaveBeenCalledWith({
      from: './main.ts',
      to: './docs/main.ts',
    });
  });

  it('does not move when the drop destination already exists', async () => {
    existsMock.mockResolvedValue(true);
    const fixture = await compileAndCreate();
    await connectReady(fixture);

    fixture.componentInstance.onNodeDropped({
      source: treeNodes[1],
      targetDirectory: treeNodes[0],
    });

    await vi.waitFor(() => {
      expect(fixture.componentInstance.errorMessage).toBe(
        '「main.ts」は既に存在します',
      );
    });
    expect(moveMock).not.toHaveBeenCalled();
  });

  it('moves a node to the parent directory on parent drop', async () => {
    const nestedNodes: FileTreeNode[] = [
      { name: 'readme.md', path: './docs/readme.md', isDirectory: false },
    ];
    const fixture = await compileAndCreate();
    await connectReady(fixture);

    listTreeMock.mockResolvedValue(nestedNodes);
    fixture.componentRef.setInput('currentPath', './docs');
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('./docs');
    });
    fixture.detectChanges();

    const dataTransfer = {
      getData: (type: string) =>
        type === 'text/plain' ||
        type === 'application/x-chirimen-file-tree-path'
          ? './docs/readme.md'
          : '',
      dropEffect: 'none',
    } as DataTransfer;
    const dropEvent = new Event('drop', {
      bubbles: true,
      cancelable: true,
    }) as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
    });

    const renamedSpy = vi.spyOn(fixture.componentInstance.fileRenamed, 'emit');
    fixture.componentInstance.onParentDrop(dropEvent);

    await vi.waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith('./docs/readme.md', './readme.md');
    });
    expect(renamedSpy).toHaveBeenCalledWith({
      from: './docs/readme.md',
      to: './readme.md',
    });
  });

  it('emits fileDeleted after deleting a node', async () => {
    dialogOpen.mockReturnValue({ closed: of(true) });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    const deletedSpy = vi.spyOn(fixture.componentInstance.fileDeleted, 'emit');

    fixture.componentInstance.onMenuAction('delete');
    await vi.waitFor(() => {
      expect(deletedSpy).toHaveBeenCalledWith('./docs');
    });
  });

  it('warns about unsaved drafts in the delete confirm message', async () => {
    dialogOpen.mockReturnValue({ closed: of(false) });
    hasUnsavedDraftMock.mockReturnValue(true);
    const fixture = await compileAndCreate();
    fixture.componentRef.setInput('hasUnsavedDraft', hasUnsavedDraftMock);
    await connectReady(fixture);

    fixture.componentInstance.onMenuAction('delete');
    await fixture.whenStable();

    expect(dialogOpen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          message: '「docs」には未保存の変更があります。削除しますか？',
        }),
      }),
    );
  });

  it('deletes a directory recursively after confirm', async () => {
    dialogOpen.mockReturnValue({ closed: of(true) });
    const fixture = await compileAndCreate();
    await connectReady(fixture);

    fixture.componentInstance.onMenuAction('delete');
    await vi.waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith('./docs', { recursive: true });
    });
  });

  it('does not delete when confirm is cancelled', async () => {
    dialogOpen.mockReturnValue({ closed: of(false) });
    const fixture = await compileAndCreate();
    await connectReady(fixture);

    fixture.componentInstance.onMenuAction('delete');
    await fixture.whenStable();

    expect(removeMock).not.toHaveBeenCalled();
  });

  it('shows error message when an operation fails', async () => {
    dialogOpen.mockReturnValue({ closed: of('x.txt') });
    touchMock.mockRejectedValue(new Error('disk full'));
    const fixture = await compileAndCreate();
    await connectReady(fixture);

    fixture.componentInstance.onMenuAction('new-file');
    await vi.waitFor(() => {
      expect(fixture.componentInstance.errorMessage).toBe('disk full');
    });
    expect(fixture.componentInstance.operationBusy).toBe(false);
  });

  it('ignores menu actions while busy', async () => {
    dialogOpen.mockReturnValue({ closed: of('busy.txt') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.componentInstance.operationBusy = true;
    listTreeMock.mockClear();

    fixture.componentInstance.onMenuAction('new-file');
    await fixture.whenStable();

    expect(touchMock).not.toHaveBeenCalled();
    expect(listTreeMock).not.toHaveBeenCalled();
  });

  it('shows never-connected empty state before serial connects', async () => {
    const fixture = await compileAndCreate();
    fixture.detectChanges();

    expect(fixture.componentInstance.viewState).toBe('neverConnected');
    expect(fixture.nativeElement.textContent).toContain(
      'CHIRIMEN Lite に接続されていません',
    );
  });

  it('shows connecting state while bootstrap is not ready', async () => {
    const fixture = await compileAndCreate();
    fixture.detectChanges();
    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: false,
      setupStatus: 'idle',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.viewState).toBe('connecting');
    expect(fixture.nativeElement.textContent).toContain(
      'CHIRIMEN Lite に接続しています',
    );
  });

  it('shows empty directory state when listTree returns no nodes', async () => {
    listTreeMock.mockResolvedValue([]);
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.viewState).toBe('empty');
    expect(fixture.nativeElement.textContent).toContain(
      'このフォルダーにはファイルがありません',
    );
  });

  it('shows fetch failure with retry and reloads on click', async () => {
    listTreeMock.mockRejectedValueOnce(new Error('disk full'));
    const fixture = await compileAndCreate();
    fixture.detectChanges();
    vmSignal.set({
      ...baseVm,
      isConnected: true,
      isLoggedIn: true,
      setupStatus: 'ready',
    });
    await vi.waitFor(() => {
      expect(fixture.componentInstance.viewState).toBe('fetchFailed');
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'ファイル一覧を取得できませんでした',
    );
    expect(fixture.nativeElement.textContent).toContain('再試行');

    listTreeMock.mockResolvedValueOnce(treeNodes);
    await fixture.componentInstance.reload();
    fixture.detectChanges();

    expect(fixture.componentInstance.viewState).toBe('ready');
    expect(fixture.componentInstance.nodes).toEqual(treeNodes);
  });

  it('shows disconnected state after a prior connected session ends', async () => {
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    vmSignal.set({ ...baseVm, isConnected: false });
    fixture.detectChanges();

    expect(fixture.componentInstance.viewState).toBe('disconnected');
    expect(fixture.nativeElement.textContent).toContain(
      'CHIRIMEN Lite との接続が切断されました',
    );
    expect(fixture.componentInstance.contextMenuDisabled).toBe(true);
  });
});
