import type { ExampleJson, ExampleItem } from '../models/example.model';

export function convertExampleJsonToList(
  jsonList: ExampleJson[],
): ExampleItem[] {
  return jsonList.map((json: ExampleJson) => ({
    ...json,
    js: '',
    circuit: '',
    link: '',
  }));
}
