/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
});
