/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileTreeFeatureComponent } from './file-tree-feature.component';
import { FileTreeNode } from '../../models';
import { FileService } from '../../service';
import { PiZeroShellReadinessService, SerialConnectionViewModelFacade } from '@libs-web-serial';
import { BehaviorSubject, of } from 'rxjs';

describe('FileTreeFeatureComponent', () => {
  const listTreeMock = vi.fn<() => Promise<FileTreeNode[]>>();
  let readySubject: BehaviorSubject<boolean>;

  const treeNodes: FileTreeNode[] = [
    { name: 'docs', path: './docs', isDirectory: true },
    { name: 'main.ts', path: './main.ts', isDirectory: false },
  ];

  async function compileAndCreate(
    initialReady: boolean,
  ): Promise<ComponentFixture<FileTreeFeatureComponent>> {
    readySubject = new BehaviorSubject(initialReady);
    const shellReadiness: Pick<
      PiZeroShellReadinessService,
      'ready$' | 'isReady' | 'setReady' | 'reset'
    > = {
      ready$: readySubject.asObservable(),
      isReady: () => readySubject.value,
      setReady: (v: boolean) => readySubject.next(v),
      reset: () => readySubject.next(false),
    };

    await TestBed.configureTestingModule({
      imports: [FileTreeFeatureComponent],
      providers: [
        {
          provide: FileService,
          useValue: { listTree: listTreeMock },
        },
        {
          provide: PiZeroShellReadinessService,
          useValue: shellReadiness,
        },
        {
          provide: SerialConnectionViewModelFacade,
          useValue: {
            vm$: of({
              isBrowserSupported: true,
              isConnected: true,
              isConnecting: false,
              isLoggedIn: initialReady,
              isInitializing: false,
              setupStatus: 'idle',
              errorMessage: null,
            }),
          },
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
    const fixture = await compileAndCreate(false);
    expect(fixture.componentInstance).toBeTruthy();
    await fixture.whenStable();
  });

  it('defers listTree until shell becomes ready', async () => {
    const fixture = await compileAndCreate(false);
    await fixture.whenStable();

    expect(listTreeMock).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('mat-progress-spinner'),
    ).toBeTruthy();

    readySubject.next(true);
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('.');
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.nodes.length).toBe(2);
  });

  it('loads nodes on init when shell is already ready', async () => {
    const fixture = await compileAndCreate(true);
    await vi.waitFor(() => {
      expect(listTreeMock).toHaveBeenCalledWith('.');
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.nodes.length).toBe(2);
  });
});
