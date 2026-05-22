/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PinAccordionComponent } from './pin-accordion.component';

describe('PinAccordionComponent', () => {
  let component: PinAccordionComponent;
  let fixture: ComponentFixture<PinAccordionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinAccordionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PinAccordionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
