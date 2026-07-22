import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ExampleItemComponent } from './example-item.component';

describe('ExampleItemComponent', () => {
  let component: ExampleItemComponent;
  let fixture: ComponentFixture<ExampleItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExampleItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Test');
    fixture.componentRef.setInput('exampleItem', [
      {
        id: 'hello-real-world',
        title: 'Lチカ',
        overview: 'blink',
        js: '',
        circuit: '',
        link: '',
      },
    ]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits saveExample when download is not in progress', () => {
    const emitSpy = vi.spyOn(component.saveExample, 'emit');
    component.onSave({
      id: 'hello-real-world',
      title: 'Lチカ',
      overview: 'blink',
      js: '',
      circuit: '',
      link: '',
    });
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('does not emit saveExample while download is in progress', () => {
    fixture.componentRef.setInput('downloadInProgress', true);
    fixture.detectChanges();
    const emitSpy = vi.spyOn(component.saveExample, 'emit');
    component.onSave({
      id: 'hello-real-world',
      title: 'Lチカ',
      overview: 'blink',
      js: '',
      circuit: '',
      link: '',
    });
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
