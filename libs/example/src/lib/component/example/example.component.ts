import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { DialogService } from '@libs-dialogs';
import { ButtonComponent } from '@libs-shared/component/button';
import { EditorService } from '@libs-editor';
import { BehaviorSubject, firstValueFrom, forkJoin } from 'rxjs';
import { ExampleListComponent } from '../example-list/example-list.component';
import { ExampleItem } from '../../models/example.model';
import { ExampleDataService } from '../../service/example.data.service';
import { ExampleService } from '../../service/example.service';

@Component({
  selector: 'choh-example',
  imports: [ButtonComponent, ExampleListComponent, AsyncPipe],
  templateUrl: './example.component.html',
  host: {
    class: 'block h-full min-h-0 min-w-0',
  },
})
export class ExampleComponent implements OnInit {
  private dialogService = inject(DialogService);
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

  closeModal(): void {
    this.dialogService.close();
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
