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

  it('should render file name with dirty marker', async () => {
    fixture.componentRef.setInput('fileName', 'main.js');
    fixture.componentRef.setInput('isDirty', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('main.js');
    expect(fixture.nativeElement.textContent).toContain('*');
  });
});
