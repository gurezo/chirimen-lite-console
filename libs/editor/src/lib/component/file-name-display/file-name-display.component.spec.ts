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

  it('should render file name with dirty marker and status label', async () => {
    fixture.componentRef.setInput('fileName', 'main.js');
    fixture.componentRef.setInput('saveStatus', 'unsavedChanges');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('main.js');
    expect(fixture.nativeElement.textContent).toContain('*');
    expect(fixture.nativeElement.textContent).toContain('Unsaved changes');
  });

  it('should show saved to device without dirty marker', async () => {
    fixture.componentRef.setInput('fileName', 'main.js');
    fixture.componentRef.setInput('saveStatus', 'savedToDevice');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Saved to device');
    expect(fixture.nativeElement.textContent).not.toContain('*');
  });
});
