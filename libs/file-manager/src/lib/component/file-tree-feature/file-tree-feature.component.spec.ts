/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { FileTreeFeatureComponent } from './file-tree-feature.component';
import { FileTreeNode } from '../../models';
import { FileService } from '../../service';
import { SerialConnectionViewModelFacade } from '@libs-web-serial';
import type { SerialConnectionViewModel } from '@libs-web-serial';

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
      imports: [FileTreeFeatureComponent],
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

  it('defers listTree until vm reports logged in', async () => {
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
});
