import { DataFrame, Field, Vector } from '@grafana/data';

export interface MapOptions {
  center_lat: number;
  center_lon: number;
  zoom_level: number;
  max_zoom: number;
  tile_url: string;
}

export const defaults: MapOptions = {
  center_lat: 48.262725,
  center_lon: 11.66725,
  zoom_level: 18,
  max_zoom: 22,
  tile_url: '',
};

interface Buffer extends Vector {
  buffer: any;
}

export interface FieldBuffer extends Field<any, Vector> {
  values: Buffer;
}

export interface Frame extends DataFrame {
  fields: FieldBuffer[];
}
