/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SetupStepListComponent } from './setup-step-list.component';

describe('SetupStepListComponent', () => {
  let component: SetupStepListComponent;
  let fixture: ComponentFixture<SetupStepListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetupStepListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupStepListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
