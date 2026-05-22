export interface ExampleJson {
  id: string;
  title: string;
  overview: string;
}

export interface ExampleItem extends ExampleJson {
  js: string;
  circuit: string;
  link: string;
}
