import type { ExampleJson, ExampleItem } from '@libs-shared';

export type { ExampleJson, ExampleItem } from '@libs-shared';

export function convertExampleJsonToList(
  jsonList: ExampleJson[]
): ExampleItem[] {
  return jsonList.map((json: ExampleJson) => ({
    ...json,
    js: '',
    circuit: '',
    link: '',
  }));
}
