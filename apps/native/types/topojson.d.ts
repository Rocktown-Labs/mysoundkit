declare module "topojson-client" {
  export function feature(topology: any, object: any): any;
}

declare module "topojson-specification" {
  export interface Topology {
    type: "Topology";
    objects: Record<string, any>;
    arcs: any[];
    bbox?: number[];
    transform?: any;
  }
}
