/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  DialogService,
  RecommendedEnvironmentDialogComponent,
} from '@libs-dialogs';
import { vi } from 'vitest';
import { HeaderToolbarComponent } from './header-toolbar.component';

describe('HeaderToolbarComponent', () => {
  let component: HeaderToolbarComponent;
  let fixture: ComponentFixture<HeaderToolbarComponent>;
  let openDialog: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    openDialog = vi.fn();

    await TestBed.configureTestingModule({
      imports: [HeaderToolbarComponent],
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: { open: openDialog } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render burger menu trigger', () => {
    expect(
      fixture.nativeElement.querySelector('.mat-mdc-menu-trigger'),
    ).not.toBeNull();
  });

  it('should set tooltip on disconnect menu item', () => {
    const trigger: HTMLElement | null = fixture.nativeElement.querySelector(
      '.mat-mdc-menu-trigger',
    );
    trigger?.click();
    fixture.detectChanges();

    const menuItems = fixture.debugElement.queryAll(
      By.css('button[mat-menu-item]'),
    );
    const disconnectButton = menuItems.find((item) =>
      item.nativeElement.textContent?.includes('Web Serial DisConnect'),
    );
    expect(disconnectButton).toBeDefined();

    const tooltip = disconnectButton!.injector.get(MatTooltip);
    expect(tooltip.message).toBe('Web Serial の切断');
  });

  it('should open recommended environment dialog from menu', () => {
    const trigger: HTMLElement | null = fixture.nativeElement.querySelector(
      '.mat-mdc-menu-trigger',
    );
    trigger?.click();
    fixture.detectChanges();

    const menuItems = fixture.debugElement.queryAll(
      By.css('button[mat-menu-item]'),
    );
    const recommendedButton = menuItems.find((item) =>
      item.nativeElement.textContent?.includes('推奨環境'),
    );
    expect(recommendedButton).toBeDefined();

    const tooltip = recommendedButton!.injector.get(MatTooltip);
    expect(tooltip.message).toBe('推奨環境を表示');

    recommendedButton!.nativeElement.click();
    expect(openDialog).toHaveBeenCalledWith(
      RecommendedEnvironmentDialogComponent,
    );
  });
});
