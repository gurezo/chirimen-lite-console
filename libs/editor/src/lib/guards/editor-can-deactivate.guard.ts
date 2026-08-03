import { CanDeactivateFn } from '@angular/router';
import { EditorPageComponent } from '../component/editor-page/editor-page.component';

export const editorCanDeactivateGuard: CanDeactivateFn<EditorPageComponent> = (
  component,
) => component.canDeactivate();
