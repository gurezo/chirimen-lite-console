/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileNameDisplayComponent } from './file-name-display.component';

describe('FileNameDisplayComponent', () => {
  let component: FileNameDisplayComponent;
  let fixture: ComponentFixture<FileNameDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileNameDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileNameDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no file is selected', () => {
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="editor-no-file-selected"]',
      )?.textContent,
    ).toContain('No file selected');
    expect(
      fixture.nativeElement.querySelector('[data-testid="editor-file-path"]'),
    ).toBeNull();
  });

  it('should render full path with dirty marker, language, and status', async () => {
    fixture.componentRef.setInput('filePath', '/home/pi/examples/i2c/main.js');
    fixture.componentRef.setInput('languageLabel', 'JavaScript');
    fixture.componentRef.setInput('saveStatus', 'unsavedChanges');
    fixture.detectChanges();
    await fixture.whenStable();

    const pathEl = fixture.nativeElement.querySelector(
      '[data-testid="editor-file-path"]',
    ) as HTMLElement;
    expect(pathEl.textContent).toContain('/home/pi/examples/i2c/main.js');
    expect(pathEl.textContent).toContain('*');
    expect(pathEl.getAttribute('title')).toBe('/home/pi/examples/i2c/main.js');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="editor-language-label"]',
      )?.textContent,
    ).toContain('JavaScript');
    expect(
      fixture.nativeElement.querySelector('[data-testid="editor-save-status"]')
        ?.textContent,
    ).toContain('Unsaved changes');
  });

  it('should show saved to device with last saved time', async () => {
    const noon = new Date(2026, 7, 3, 20, 42, 0).getTime();
    fixture.componentRef.setInput('filePath', '/home/pi/main.js');
    fixture.componentRef.setInput('languageLabel', 'JavaScript');
    fixture.componentRef.setInput('saveStatus', 'savedToDevice');
    fixture.componentRef.setInput('lastSavedAt', noon);
    fixture.detectChanges();
    await fixture.whenStable();

    const status = fixture.nativeElement.querySelector(
      '[data-testid="editor-save-status"]',
    )?.textContent;
    expect(status).toContain('Saved to device');
    expect(status).toContain('20:42');
    expect(fixture.nativeElement.textContent).not.toContain('*');
  });

  it('should show draft saved locally without conflating device save', async () => {
    fixture.componentRef.setInput('filePath', '/home/pi/main.js');
    fixture.componentRef.setInput('saveStatus', 'draftSavedLocally');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('[data-testid="editor-save-status"]')
        ?.textContent,
    ).toContain('Draft saved locally');
    expect(fixture.nativeElement.textContent).not.toContain('Saved to device');
  });

  it('should show read-only badge when readOnly is true', async () => {
    fixture.componentRef.setInput('filePath', '/etc/hosts');
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="editor-readonly-badge"]',
      )?.textContent,
    ).toContain('Read-only');
  });
});
