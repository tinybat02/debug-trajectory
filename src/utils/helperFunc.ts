import { FieldBuffer } from '../types';
import { Coordinate } from 'ol/coordinate';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Circle, Stroke, Style, Fill, Icon } from 'ol/style';
import Arrow from '../img/arrow.png';

interface ProcessedData {
  perUserRoute: { [key: string]: [number, number][] };
  perUserRouteRadius: { [key: string]: number[] };
  perUserVendorName: { [key: string]: string };
  perUserTime: { [key: string]: number[] };
}

export const processReceivedData = (length: number, fields: FieldBuffer[]): ProcessedData => {
  const perUserRoute: { [key: string]: [number, number][] } = {};
  const perUserRouteRadius: { [key: string]: number[] } = {};
  const perUserVendorName: { [key: string]: string } = {};
  const perUserTime: { [key: string]: number[] } = {};

  for (let i = 0; i < length; i++) {
    (perUserRoute[fields[0].values.buffer[i]] = perUserRoute[fields[0].values.buffer[i]] || []).push([
      fields[2].values.buffer[i],
      fields[1].values.buffer[i],
    ]);

    (perUserRouteRadius[fields[0].values.buffer[i]] = perUserRouteRadius[fields[0].values.buffer[i]] || []).push(fields[3].values.buffer[i]);

    !perUserVendorName[fields[0].values.buffer[i]] ? (perUserVendorName[fields[0].values.buffer[i]] = fields[4].values.buffer[i]) : null;

    (perUserTime[fields[0].values.buffer[i]] = perUserTime[fields[0].values.buffer[i]] || []).push(fields[5].values.buffer[i]);
  }
  return { perUserRoute, perUserRouteRadius, perUserVendorName, perUserTime };
};

export const createLine = (routeData: Coordinate[], timeData: number[], iterRoute: number) => {
  const dx = routeData[iterRoute + 1][0] - routeData[iterRoute][0];
  const dy = routeData[iterRoute + 1][1] - routeData[iterRoute][1];
  const rotation = Math.atan2(dy, dx);
  const lineFeature = new Feature(new LineString([routeData[iterRoute], routeData[iterRoute + 1]]));
  lineFeature.setProperties({ duration: `${(timeData[iterRoute + 1] - timeData[iterRoute]) / 1000}s` });
  lineFeature.setStyle([
    new Style({
      stroke: new Stroke({
        color: '#0080ff',
        width: 2,
      }),
    }),
    new Style({
      geometry: new Point(routeData[iterRoute + 1]),
      image: new Icon({
        src: Arrow,
        anchor: [0.75, 0.5],
        rotateWithView: true,
        rotation: -rotation,
      }),
    }),
  ]);
  return lineFeature;
};

export const createPoint = (routeData: Coordinate[], routeRadiusData: number[], iterRoute: number) => {
  const pointFeature = new Feature(new Point(routeData[iterRoute]));
  pointFeature.setStyle(
    new Style({
      image: new Circle({
        radius: routeRadiusData[iterRoute],
        fill: new Fill({ color: 'rgba(73,168,222,0.6)' }),
      }),
    })
  );
  return pointFeature;
};
