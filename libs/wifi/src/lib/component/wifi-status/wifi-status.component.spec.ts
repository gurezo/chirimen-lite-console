/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WifiStatusComponent } from './wifi-status.component';

describe('WifiStatusComponent', () => {
  let component: WifiStatusComponent;
  let fixture: ComponentFixture<WifiStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WifiStatusComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WifiStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
