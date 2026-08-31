import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
})
export class TruncatePipe implements PipeTransform {
  transform(
    value: string | null | undefined,
    limit = 60,
    trail = '...',
  ): string {
    if (value == null || value === '') {
      return '';
    }
    if (value.length <= limit) {
      return value;
    }
    return value.slice(0, limit) + trail;
  }
}
