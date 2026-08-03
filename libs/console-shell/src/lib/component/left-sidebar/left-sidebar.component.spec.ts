/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { FileService } from '@libs-file-manager';
import {
  SerialConnectionViewModelFacade,
  type SerialConnectionViewModel,
} from '@libs-web-serial';
import { signal } from '@angular/core';
import { EMPTY } from 'rxjs';
import { LeftSidebarComponent } from './left-sidebar.component';
import { ConsoleShellStore, EDITOR_DRAFT_LIFECYCLE } from '@libs-shared';

const baseVm: SerialConnectionViewModel = {
  isBrowserSupported: true,
  isConnected: false,
  isConnecting: false,
  isLoggedIn: false,
  isInitializing: false,
  setupStatus: 'idle',
  errorMessage: null,
};

describe('LeftSidebarComponent', () => {
  let component: LeftSidebarComponent;
  let fixture: ComponentFixture<LeftSidebarComponent>;
  const draftLifecycle = {
    has: vi.fn<(path: string) => boolean>().mockReturnValue(false),
    rename: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(async () => {
    draftLifecycle.has.mockReset().mockReturnValue(false);
    draftLifecycle.rename.mockReset();
    draftLifecycle.clear.mockReset();

    const activatedRoute = {
      firstChild: null,
      snapshot: { url: [] },
    } as unknown as ActivatedRoute;

    await TestBed.configureTestingModule({
      imports: [LeftSidebarComponent],
      providers: [
        provideMockStore(),
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true), events: EMPTY },
        },
        { provide: ActivatedRoute, useValue: activatedRoute },
        {
          provide: SerialConnectionViewModelFacade,
          useValue: {
            vm: signal(baseVm).asReadonly(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            sendCommand: vi.fn(),
            clearError: vi.fn(),
          },
        },
        {
          provide: FileService,
          useValue: { listTree: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: EDITOR_DRAFT_LIFECYCLE,
          useValue: draftLifecycle,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeftSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleLeftSidebar when the panel toggle is clicked', () => {
    const emitSpy = vi.spyOn(component.toggleLeftSidebar, 'emit');
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button[mat-icon-button]');

    buttons[1]?.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit toggleLeftSidebar when the folder icon is clicked', () => {
    const emitSpy = vi.spyOn(component.toggleLeftSidebar, 'emit');
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button[mat-icon-button]');

    buttons[0]?.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('should not render file tree when left nav is closed', () => {
    fixture.componentRef.setInput('leftNavOpen', false);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('lib-file-tree-feature'),
    ).toBeNull();
  });

  it('updates store path on currentPathChange without clearing selection', () => {
    const store = TestBed.inject(ConsoleShellStore);
    store.setSelectedFilePath('./docs/readme.md');
    store.setFileManagerCurrentPath('./docs');

    component.onCurrentPathChange('./home');

    expect(store.fileManagerCurrentPath()).toBe('./home');
    expect(store.selectedFilePath()).toBe('./docs/readme.md');
  });

  it('renames draft and selected path when the open file is renamed', () => {
    const store = TestBed.inject(ConsoleShellStore);
    store.setSelectedFilePath('./old.js');

    component.onFileRenamed({ from: './old.js', to: './new.js' });

    expect(draftLifecycle.rename).toHaveBeenCalledWith('./old.js', './new.js');
    expect(store.selectedFilePath()).toBe('./new.js');
  });

  it('clears draft and selection when the open file is deleted', () => {
    const store = TestBed.inject(ConsoleShellStore);
    store.setSelectedFilePath('./gone.js');

    component.onFileDeleted('./gone.js');

    expect(draftLifecycle.clear).toHaveBeenCalledWith('./gone.js');
    expect(store.selectedFilePath()).toBeNull();
  });

  it('passes selected file path to the file tree feature', () => {
    const store = TestBed.inject(ConsoleShellStore);
    store.setSelectedFilePath('./main.ts');
    fixture.detectChanges();

    const tree = fixture.debugElement.query(By.css('lib-file-tree-feature'));
    expect(tree).not.toBeNull();
    expect(tree.componentInstance.selectedPath()).toBe('./main.ts');
  });

  it('sets selected file path and navigates to editor on file select', () => {
    const store = TestBed.inject(ConsoleShellStore);
    const router = TestBed.inject(Router);

    component.onFileSelected('./home/pi/app.js');

    expect(store.selectedFilePath()).toBe('./home/pi/app.js');
    expect(router.navigate).toHaveBeenCalledWith(['editor'], {
      relativeTo: TestBed.inject(ActivatedRoute),
    });
  });

  it('should set tooltip on panel toggle based on open state', () => {
    const openButton = fixture.debugElement.query(
      By.css('button[aria-label="ファイツリー閉じる"]'),
    );
    expect(openButton).not.toBeNull();
    expect(openButton.injector.get(MatTooltip).message).toBe(
      'ファイツリー閉じる',
    );

    fixture.componentRef.setInput('leftNavOpen', false);
    fixture.detectChanges();

    const closedButton = fixture.debugElement.query(
      By.css('button[aria-label="ファイツリー開く"]'),
    );
    expect(closedButton).not.toBeNull();
    expect(closedButton.injector.get(MatTooltip).message).toBe(
      'ファイツリー開く',
    );
  });
});
