/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreadcrumbComponent } from './breadcrumb.component';

describe('BreadcrumbComponent', () => {
  let component: BreadcrumbComponent;
  let fixture: ComponentFixture<BreadcrumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreadcrumbComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BreadcrumbComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('segments', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders nothing when segments are empty', () => {
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });

  it('renders one list item per segment', () => {
    fixture.componentRef.setInput('segments', [
      { label: 'Console' },
      { label: 'Terminal' },
    ]);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Console');
    expect(fixture.nativeElement.textContent).toContain('Terminal');
  });

  it('marks the last segment as current page', () => {
    fixture.componentRef.setInput('segments', [
      { label: 'Console' },
      { label: 'Editor' },
    ]);
    fixture.detectChanges();

    const current = fixture.nativeElement.querySelector('[aria-current="page"]');
    expect(current?.textContent?.trim()).toBe('Editor');
  });

  it('emits segmentNavigate when a clickable path segment is activated', () => {
    const emitSpy = vi.spyOn(component.segmentNavigate, 'emit');
    fixture.componentRef.setInput('segments', [
      { label: 'Console' },
      { label: 'home', path: './home', clickable: true },
      { label: 'pi', clickable: false },
    ]);
    fixture.detectChanges();

    const button: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('button');
    button?.click();

    expect(emitSpy).toHaveBeenCalledWith('./home');
  });

  it('does not render a button for non-clickable intermediate labels', () => {
    fixture.componentRef.setInput('segments', [
      { label: 'Console' },
      { label: 'Editor' },
      { label: 'main.js' },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
