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
  const removeMock = vi.fn<() => Promise<void>>();
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
            remove: removeMock,
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
    removeMock.mockReset();
    removeMock.mockResolvedValue(undefined);
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

  it('creates a file from context menu action', async () => {
    dialogOpen.mockReturnValue({ closed: of('new.txt') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    listTreeMock.mockClear();

    fixture.componentInstance.onMenuAction('new-file');
    await vi.waitFor(() => {
      expect(touchMock).toHaveBeenCalledWith('./docs/new.txt');
    });
    expect(listTreeMock).toHaveBeenCalledWith('.');
    expect(fixture.componentInstance.operationBusy).toBe(false);
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

  it('creates a directory from context menu action', async () => {
    dialogOpen.mockReturnValue({ closed: of('src') });
    const fixture = await compileAndCreate();
    await connectReady(fixture);

    fixture.componentInstance.onMenuAction('new-directory');
    await vi.waitFor(() => {
      expect(mkdirMock).toHaveBeenCalledWith('./docs/src');
    });
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
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    fixture.componentInstance.operationBusy = true;

    fixture.componentInstance.onMenuAction('reload');
    await fixture.whenStable();

    expect(listTreeMock).toHaveBeenCalledTimes(1);
  });

  it('reloads from context menu action', async () => {
    const fixture = await compileAndCreate();
    await connectReady(fixture);
    listTreeMock.mockClear();

    fixture.componentInstance.onMenuAction('reload');
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('.');
    });
  });
});
