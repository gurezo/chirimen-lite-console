import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PinAssignComponent } from './pin-assign.component';

describe('PinAssignComponent', () => {
  let component: PinAssignComponent;
  let fixture: ComponentFixture<PinAssignComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinAssignComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PinAssignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
