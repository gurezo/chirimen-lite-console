import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { EditorService } from '@libs-editor';
import { BehaviorSubject, firstValueFrom, forkJoin } from 'rxjs';
import { ExampleItem } from '../../models';
import { ExampleDataService, ExampleService } from '../../service';
import { ExampleListComponent } from '../example-list/example-list.component';

@Component({
  selector: 'choh-example',
  imports: [ExampleListComponent, AsyncPipe],
  templateUrl: './example.component.html',
  host: {
    class: 'flex min-h-0 h-full w-full flex-col',
  },
})
export class ExampleComponent implements OnInit {
  private exampleDataService = inject(ExampleDataService);
  private exampleService = inject(ExampleService);
  private editorService = inject(EditorService);

  exampleSubject = new BehaviorSubject<
    [ExampleItem[], ExampleItem[], ExampleItem[]]
  >([[], [], []]);
  example$ = this.exampleSubject.asObservable();

  ngOnInit(): void {
    this.example$ = forkJoin([
      this.exampleDataService.getGPIOExampleList(),
      this.exampleDataService.getI2CExampleList(),
      this.exampleDataService.getRemoteExampleList(),
    ]);
  }

  async onSaveExample(example: ExampleItem): Promise<void> {
    try {
      const blob = await firstValueFrom(
        this.exampleService.downloadMainJs(example.id),
      );
      const text = await blob.text();
      await this.editorService.saveTextFile(`/home/pi/${example.id}.js`, text);
    } catch (error) {
      console.warn('Failed to save example', error);
    }
  }
}
