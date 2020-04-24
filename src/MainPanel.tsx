import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { MapOptions, FieldBuffer } from 'types';
import { Map, View } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Stroke, Style, Text } from 'ol/style';
import XYZ from 'ol/source/XYZ';
import { fromLonLat } from 'ol/proj';
import { defaults, DragPan, MouseWheelZoom } from 'ol/interaction';
import { platformModifierKeyOnly } from 'ol/events/condition';
import Select from 'ol/interaction/Select';
import { pointerMove } from 'ol/events/condition';
import nanoid from 'nanoid';
import { processReceivedData, createLine, createPoint } from './utils/helperFunc';
import 'ol/ol.css';
import './style/main.css';

interface Props extends PanelProps<MapOptions> {}
interface State {
  options: string[];
  current: string;
  iterRoute: number;
  routeLength: number;
  showTotalRoute: boolean;
}

export class MainPanel extends PureComponent<Props> {
  id = 'id' + nanoid();
  map: Map;
  randomTile: TileLayer;
  perUserRoute: { [key: string]: [number, number][] };
  perUserRouteRadius: { [key: string]: number[] };
  perUserVendorName: { [key: string]: string };
  perUserTime: { [key: string]: number[] };
  route: VectorLayer;
  totalRoute: VectorLayer;

  state: State = {
    options: [],
    current: 'None',
    iterRoute: 0,
    routeLength: 0,
    showTotalRoute: false,
  };

  componentDidMount() {
    const { center_lat, center_lon, zoom_level, max_zoom, tile_url } = this.props.options;

    const fields = this.props.data.series[0].fields as FieldBuffer[];

    const carto = new TileLayer({
      source: new XYZ({
        url: 'https://{1-4}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      }),
    });

    this.map = new Map({
      interactions: defaults({ dragPan: false, mouseWheelZoom: false, onFocusOnly: true }).extend([
        new DragPan({
          condition: function(event) {
            return platformModifierKeyOnly(event) || this.getPointerCount() === 2;
          },
        }),
        new MouseWheelZoom({
          condition: platformModifierKeyOnly,
        }),
      ]),
      layers: [carto],
      view: new View({
        center: fromLonLat([center_lon, center_lat]),
        zoom: zoom_level,
        maxZoom: max_zoom,
      }),
      target: this.id,
    });

    const hoverInteraction = new Select({
      condition: pointerMove,
      style: function(feature) {
        const style: { [key: string]: Style[] } = {};
        const geometry_type = feature.getGeometry().getType(),
          white = [255, 255, 255, 1],
          blue = [0, 153, 255, 1],
          width = 4;

        style['LineString'] = [
          new Style({
            stroke: new Stroke({
              color: white,
              width: width + 2,
            }),
            text: new Text({
              stroke: new Stroke({
                color: '#fff',
                width: 2,
              }),
              font: '18px Calibri,sans-serif',
              text: feature.get('duration'),
            }),
          }),
          new Style({
            stroke: new Stroke({
              color: blue,
              width: width,
            }),
          }),
        ];

        return style[geometry_type];
      },
    });
    this.map.addInteraction(hoverInteraction);
    if (fields[2].values.buffer.length !== 0) {
      const { perUserRoute, perUserRouteRadius, perUserVendorName, perUserTime } = processReceivedData(this.props.data.series[0].length, fields);

      this.perUserRoute = perUserRoute;
      this.perUserRouteRadius = perUserRouteRadius;
      this.perUserVendorName = perUserVendorName;
      this.perUserTime = perUserTime;
      this.setState({
        options: Object.keys(this.perUserRoute),
      });
    }

    if (tile_url !== '') {
      this.randomTile = new TileLayer({
        source: new XYZ({
          url: tile_url,
        }),
        zIndex: 1,
      });
      this.map.addLayer(this.randomTile);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.data.series[0] !== this.props.data.series[0]) {
      const newFields = this.props.data.series[0].fields as FieldBuffer[];

      if (newFields[1].values.buffer.length !== 0) {
        const { perUserRoute, perUserRouteRadius, perUserVendorName, perUserTime } = processReceivedData(this.props.data.series[0].length, newFields);

        this.perUserRoute = perUserRoute;
        this.perUserRouteRadius = perUserRouteRadius;
        this.perUserVendorName = perUserVendorName;
        this.perUserTime = perUserTime;
        this.setState({ options: Object.keys(this.perUserRoute) });
      } else {
        this.map.removeLayer(this.route);

        this.setState({
          options: [],
          current: 'None',
        });
      }
    }

    if (prevProps.options.tile_url !== this.props.options.tile_url) {
      if (this.randomTile) {
        this.map.removeLayer(this.randomTile);
      }

      if (this.props.options.tile_url !== '') {
        this.randomTile = new TileLayer({
          source: new XYZ({
            url: this.props.options.tile_url,
          }),
          zIndex: 1,
        });
        this.map.addLayer(this.randomTile);
      }
    }

    if (prevProps.options.zoom_level !== this.props.options.zoom_level) {
      this.map.getView().setZoom(this.props.options.zoom_level);
    }

    if (prevProps.options.center_lat !== this.props.options.center_lat || prevProps.options.center_lon !== this.props.options.center_lon) {
      this.map.getView().animate({
        center: fromLonLat([this.props.options.center_lon, this.props.options.center_lat]),
        duration: 2000,
      });
    }

    if (prevState.current !== this.state.current) {
      this.route && this.map.removeLayer(this.route);
      this.totalRoute && this.map.removeLayer(this.totalRoute);

      this.setState({ iterRoute: 0, routeLength: 0 });
      if (this.state.current !== 'None') {
        /*         const styles: { [key: string]: Style } = {
          route: new Style({
            stroke: new Stroke({
              color: '#0080ff',
              width: 2,
            }),
          }),
          start: new Style({
            image: new Circle({
              radius: 4,
              fill: new Fill({ color: '#26de00' }),
            }),
          }),
          end: new Style({
            image: new Circle({
              radius: 4,
              fill: new Fill({ color: '#feda21' }),
            }),
          }),
        };
        const routeData = this.perUser[this.state.current].map(item => fromLonLat(item));
        this.route = new VectorLayer({
          source: new VectorSource({
            features: [
              new Feature({
                type: 'route',
                geometry: new LineString(routeData),
              }),
              new Feature({
                type: 'start',
                geometry: new Point(routeData.slice(0, 1)[0]),
              }),
              new Feature({
                type: 'end',
                geometry: new Point(routeData.slice(-1)[0]),
              }),
            ],
          }),
          zIndex: 2,
          style: feature => {
            return styles[feature.get('type')];
          },
        }); */
        const routeData = this.perUserRoute[this.state.current].map(item => fromLonLat(item));
        const timeData = this.perUserTime[this.state.current];
        const routeRadiusData = this.perUserRouteRadius[this.state.current];
        this.setState({ routeLength: routeData.length });

        let routeFeature: Feature<LineString>[] = [];
        let totalRoute: Feature[] = [];
        if (routeData.length > 1) {
          const lineFeature = createLine(routeData, timeData, 0);
          routeFeature = [lineFeature];
          for (let i = 0; i < routeData.length - 1; i++) {
            totalRoute.push(createLine(routeData, timeData, i));
          }
        }
        /*         let routeFeature: Feature[] = [];
        if (routeData.length > 1) {
          for (let i = 0; i < routeData.length - 1; i++) {
            const dx = routeData[i + 1][0] - routeData[i][0];
            const dy = routeData[i + 1][1] - routeData[i][1];
            const rotation = Math.atan2(dy, dx);
            const lineFeature = new Feature(new LineString([routeData[i], routeData[i + 1]]));
            lineFeature.setProperties({ duration: `${(timeData[i + 1] - timeData[i]) / 1000}s` });

            lineFeature.setStyle([
              new Style({
                stroke: new Stroke({
                  color: '#0080ff',
                  width: 2,
                }),
              }),
              new Style({
                geometry: new Point(routeData[i + 1]),
                image: new Icon({
                  src: Arrow,
                  anchor: [0.75, 0.5],
                  rotateWithView: true,
                  rotation: -rotation,
                }),
              }),
            ]);
            routeFeature.push(lineFeature);
          }
        } */

        /*         const pointFeatures = routeData.map((coordinate, index) => {
          const singlePoint = new Feature(new Point(coordinate));
          singlePoint.setStyle(
            new Style({
              image: new Circle({
                radius: routeRadiusData[index],
                fill: new Fill({ color: 'rgba(73,168,222,0.6)' }),
              }),
            })
          );
          return singlePoint;
        }); */

        const pointFeatures: Feature<Point>[] = [];
        const firstPoint = createPoint(routeData, routeRadiusData, 0);
        pointFeatures.push(firstPoint);
        if (routeData.length > 1) {
          const secondPoint = createPoint(routeData, routeRadiusData, 1);
          pointFeatures.push(secondPoint);
        }

        this.route = new VectorLayer({
          source: new VectorSource({
            features: [...routeFeature, ...pointFeatures],
          }),
          zIndex: 2,
        });

        this.map.addLayer(this.route);

        const totalPoints: Feature<Point>[] = [];
        for (let i = 0; i < routeData.length; i++) {
          totalPoints.push(createPoint(routeData, routeRadiusData, i));
        }

        this.totalRoute = new VectorLayer({
          source: new VectorSource({
            features: [...totalRoute, ...totalPoints],
          }),
          zIndex: 2,
        });
      }
    }

    if (prevState.showTotalRoute !== this.state.showTotalRoute) {
      if (this.state.showTotalRoute) {
        this.map.removeLayer(this.route);
        this.map.removeLayer(this.totalRoute);
        this.map.addLayer(this.totalRoute);
      } else {
        this.map.removeLayer(this.totalRoute);
        this.map.removeLayer(this.route);
        this.map.addLayer(this.route);
      }
    }
  }

  handleSelector = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ current: e.target.value });
  };

  handleShowTotalRoute = () => {
    this.setState({ showTotalRoute: !this.state.showTotalRoute });
  };

  handleIterRoute = (type: string) => () => {
    const routeData = this.perUserRoute[this.state.current].map(item => fromLonLat(item));
    const timeData = this.perUserTime[this.state.current];
    const routeRadiusData = this.perUserRouteRadius[this.state.current];
    const { iterRoute } = this.state;
    if (type === 'previous' && iterRoute > 0) {
      this.route && this.map.removeLayer(this.route);
      this.setState({ iterRoute: iterRoute - 1 }, () => {
        const lineFeature = createLine(routeData, timeData, this.state.iterRoute);
        const beginPoint = createPoint(routeData, routeRadiusData, this.state.iterRoute);
        const endPoint = createPoint(routeData, routeRadiusData, this.state.iterRoute + 1);

        this.route = new VectorLayer({
          source: new VectorSource({
            features: [lineFeature, beginPoint, endPoint],
          }),
          zIndex: 2,
        });
        this.map.addLayer(this.route);
      });
    }

    if (type === 'next' && iterRoute < routeData.length - 2) {
      this.route && this.map.removeLayer(this.route);
      this.setState({ iterRoute: iterRoute + 1 }, () => {
        const lineFeature = createLine(routeData, timeData, this.state.iterRoute);
        const beginPoint = createPoint(routeData, routeRadiusData, this.state.iterRoute);
        const endPoint = createPoint(routeData, routeRadiusData, this.state.iterRoute + 1);

        this.route = new VectorLayer({
          source: new VectorSource({
            features: [lineFeature, beginPoint, endPoint],
          }),
          zIndex: 2,
        });
        this.map.addLayer(this.route);
      });
    }
  };

  render() {
    const { width, height } = this.props;
    const { options, current, iterRoute, routeLength, showTotalRoute } = this.state;

    return (
      <div
        style={{
          width,
          height,
        }}
      >
        <div className="custom-menu-bar">
          <div>
            <select id="selector" onChange={this.handleSelector} value={current} style={{ width: 500 }}>
              <option value="None">None</option>
              {options.map(item => (
                <option key={item} value={item}>
                  {`${item.slice(0, 8)} - ${this.perUserVendorName[item]}`}
                </option>
              ))}
            </select>
            {current !== 'None' && (
              <>
                <button className="custom-btn" onClick={this.handleIterRoute('previous')} disabled={showTotalRoute}>
                  Prev
                </button>
                <button className="custom-btn" onClick={this.handleIterRoute('next')} disabled={showTotalRoute}>
                  Next
                </button>
                <span>
                  &nbsp;{' '}
                  {` ${iterRoute + 1} / ${routeLength - 1} -- Begin: ${new Date(this.perUserTime[current][0]).toLocaleString()} -- End: ${new Date(
                    this.perUserTime[current][this.perUserTime[current].length - 1]
                  ).toLocaleString()}`}
                </span>
              </>
            )}
          </div>
          {current !== 'None' && (
            <button className="custom-btn" onClick={this.handleShowTotalRoute}>
              {showTotalRoute ? 'Show Single' : 'Show Total'} Route
            </button>
          )}
        </div>
        <div
          id={this.id}
          style={{
            width,
            height: height - 40,
          }}
        ></div>
      </div>
    );
  }
}
