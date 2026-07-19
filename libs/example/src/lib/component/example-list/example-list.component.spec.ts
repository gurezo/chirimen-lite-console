import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExampleListComponent } from './example-list.component';

describe('ExampleListComponent', () => {
  let component: ExampleListComponent;
  let fixture: ComponentFixture<ExampleListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExampleListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('gpioExample', []);
    fixture.componentRef.setInput('i2cExample', []);
    fixture.componentRef.setInput('remoteExample', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use flex-1 min-h-0 host for shell-fit scroll region', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.className).toMatch(/\bflex\b/);
    expect(host.className).toMatch(/\bflex-1\b/);
    expect(host.className).toMatch(/\bmin-h-0\b/);
    const scrollRegion = host.querySelector('.overflow-y-auto');
    expect(scrollRegion).toBeTruthy();
    expect(scrollRegion?.className).toMatch(/\bmin-h-0\b/);
    expect(scrollRegion?.className).toMatch(/\bflex-1\b/);
  });
});
