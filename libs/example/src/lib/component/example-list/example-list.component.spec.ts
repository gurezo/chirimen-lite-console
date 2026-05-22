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
});
