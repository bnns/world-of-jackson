import {Layer} from '@deck.gl/core';
// @ts-ignore
import {Model, Geometry} from '@luma.gl/core';

const defaultProps = {
  getEnd: {type: 'accessor', value: (x: any) => x.path && x.path.length ? x.path.slice(-1)[0] : [0, 0]},
  getColor: {type: 'accessor', value: [255, 255, 255, 255]},
  getWidth: {type: 'accessor', value: 3},
  getRotation: {type: 'accessor', value: 0},
  widthUnits: 'pixels',
  widthScale: {type: 'number', value: 1, min: 0},
};

const vs = `
attribute vec3 positions;
attribute vec3 instancePositions;
attribute vec3 instancePositions64Low;
attribute float instanceWidths;
attribute float instanceRotations;
attribute vec4 instanceColors;

uniform float widthScale;

varying vec4 vColor;

vec3 rotate_by_angle(vec3 vertex, float angle) {
  float angle_radian = angle * PI / 180.0;
  float cos_angle = cos(angle_radian);
  float sin_angle = sin(angle_radian);
  mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
  return vec3(rotationMatrix * vertex.xy, vertex.z);
}

void main(void) {
  geometry.worldPosition = positions;
  float widthPixels = project_size_to_pixel(instanceWidths * widthScale);
  vec3 offsetCommon = positions * project_size(widthPixels);
  vec3 positionCommon = project_position(instancePositions, instancePositions64Low);
  vec3 rotatedOffsetCommon = rotate_by_angle(offsetCommon, instanceRotations);
  gl_Position = project_common_position_to_clipspace(vec4(positionCommon + rotatedOffsetCommon, 0.0));
  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

  vColor = instanceColors;
}`;

const fs = `
precision highp float;

varying vec4 vColor;

void main(void) {
  gl_FragColor = vColor;
}`

class ArrowLayer extends Layer {
  constructor(props: any) {
    super(props);
  }

  initializeState() {
    const {gl} = this.context;

    const attributeManager = this.getAttributeManager();
    attributeManager.addInstanced({
      instancePositions: {
        size: 3,
        type: gl.DOUBLE,
        accessor: 'getEnd'
      },
      instanceColors: {
        size: 3,
        normalized: true,
        accessor: 'getColor',
        defaultValue: [0, 0, 0, 255]
      },
      instanceWidths: {
        size: 1,
        accessor: 'getWidth',
        defaultValue: 3
      },
      instanceRotations: {
        size: 1,
        accessor: 'getRotation',
        defaultValue: 0
      }
    });

    this.setState({model: this._getModel(gl)});
  }

  updateState({props, oldProps, changeFlags}: {props: any, oldProps: any, changeFlags: any}) {
    super.updateState({props, oldProps, changeFlags});

    if (changeFlags.extensionsChanged || changeFlags.viewportChanged) {
      const {gl} = this.context;
      if (this.state.model) {
        this.state.model.delete();
      }
      this.setState({model: this._getModel(gl)});
      this.getAttributeManager().invalidateAll();
    }
  }


  _getModel(gl: any) {
    const positions = new Float32Array([-1, -1, 1, -1, 0, 1]);
    const geometry = new Geometry({
      drawMode: gl.TRIANGLE_FAN,
      vertexCount: 3,
      attributes: {
        positions: {size: 2, value: positions}
      }
    });

    return new Model(gl, {...this.getShaders(), id: this.props.id, vs, fs, geometry, isInstanced: true});
  }

  draw({uniforms}: {uniforms: any}) {
    const {viewport} = this.context;
    const {widthUnits, widthScale} = this.props;

    const widthMultiplier = widthUnits === 'pixels' ? viewport.metersPerPixel : 1;

    this.state.model
      .setUniforms({
        ...uniforms,
        widthScale: widthScale * widthMultiplier
      })
      .draw();
  }
}

ArrowLayer.layerName = 'ArrowLayer';
ArrowLayer.defaultProps = defaultProps;

export default ArrowLayer
