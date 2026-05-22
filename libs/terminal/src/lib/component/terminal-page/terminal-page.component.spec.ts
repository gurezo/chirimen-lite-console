import { ComponentFixture, TestBed } from '@angular/core/testing';
import TerminalPageComponent from './terminal-page.component';

describe('TerminalPageComponent', () => {
  let component: TerminalPageComponent;
  let fixture: ComponentFixture<TerminalPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminalPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminalPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
