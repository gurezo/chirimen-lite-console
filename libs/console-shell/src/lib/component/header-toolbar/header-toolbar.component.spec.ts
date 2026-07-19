/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { HeaderToolbarComponent } from './header-toolbar.component';

describe('HeaderToolbarComponent', () => {
  let component: HeaderToolbarComponent;
  let fixture: ComponentFixture<HeaderToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderToolbarComponent],
      providers: [provideRouter([])],
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

    const disconnectButton = fixture.debugElement.query(
      By.css('button[mat-menu-item]'),
    );
    expect(disconnectButton).not.toBeNull();

    const tooltip = disconnectButton.injector.get(MatTooltip);
    expect(tooltip.message).toBe('Web Serial DisConnect');
  });
});
