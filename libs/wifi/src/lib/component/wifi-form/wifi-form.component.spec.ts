/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WifiFormComponent } from './wifi-form.component';

describe('WifiFormComponent', () => {
  let component: WifiFormComponent;
  let fixture: ComponentFixture<WifiFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WifiFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WifiFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
