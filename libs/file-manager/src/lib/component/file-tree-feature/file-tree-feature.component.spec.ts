/// <reference types="vitest/globals" />
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import type { SerialConnectionViewModel } from '@libs-web-serial';
import { SerialConnectionViewModelFacade } from '@libs-web-serial';
import { FileTreeNode } from '../../models';
import { FileService } from '../../service';
import { FileContextMenuComponent } from '../file-context-menu/file-context-menu.component';
import { FileTreeFeatureComponent } from './file-tree-feature.component';

describe('FileTreeFeatureComponent', () => {
  const listTreeMock = vi.fn<() => Promise<FileTreeNode[]>>();
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
          useValue: { listTree: listTreeMock },
        },
        {
          provide: SerialConnectionViewModelFacade,
          useValue: { vm: computed(() => vmSignal()) },
        },
      ],
    }).compileComponents();

    return TestBed.createComponent(FileTreeFeatureComponent);
  }

  beforeEach(() => {
    listTreeMock.mockReset();
    listTreeMock.mockResolvedValue(treeNodes);
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
    fixture.detectChanges();

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

  it('reloads from context menu action', async () => {
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

    fixture.componentInstance.onMenuAction('reload');
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('.');
    });
  });
});
