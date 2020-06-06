import {PathLayer} from '@deck.gl/layers';
import {CompositeLayer} from '@deck.gl/core';
import ArrowLayer from './arrow';
// @ts-ignore
import {Model, Geometry} from '@luma.gl/core';

interface PathData {
  coordinates: number[][];
  name: string;
  color: [number, number, number];
  lengths: number[],
  totalLength: number
}

export const toAngle = ([x0, y0]: [number, number], [x1, y1]: [number, number]) => {
  if (x1 - x0 > 0) {
    return 90
  } else if (x1 - x0 < 0) {
    return 270
  } else if (y1 - y0 < 0) {
    return 180
  } else {
    return 0
  }
}

const dist = ([x0, y0]: number[], [x1, y1]: number[]): number => Math.abs((x1 - x0)**2 + (y1 - y0)**2)

const resetPath = ({coordinates, ...rest}: PathData): PathData => ({...rest, coordinates: coordinates.slice(0, 1)})

interface DeterminateLength {
  lengths: number[];
  totalLength: number;
}

const findLengths = ({coordinates, ...rest}: PathData): PathData => {
  const {lengths, totalLength} = coordinates.reduce<DeterminateLength>((acc, [x, y], idx, arr) => {
    if (idx) {
      const [x0, y0]: number[] = arr[idx-1];
      const length = dist([x0, y0], [x, y])
      return {lengths: acc.lengths.concat([length]), totalLength: acc.totalLength + length}
    }
    return acc
  }, {lengths: [0], totalLength: 0})
  return {...rest, coordinates, lengths, totalLength}
}

const stopAtLength = ([x0, y0]: number[], [x1, y1]: number[], fraction: number): number[] => {
  return [x0 + (x1 - x0) * fraction, y0 + (y1 - y0) * fraction]
}

interface DeterminatePath {
  remainingLength: number;
  coordinates: number[][];
}

const slicePath = (data: PathData, coeff: number): PathData => {
  const maxLength = coeff * data.totalLength;
  const {coordinates} = data.coordinates.reduce<DeterminatePath>((acc, [x, y]: number[], idx: number, arr: number[][]) => {
    if (!idx) {
      return {...acc, coordinates: [[x, y]]} as DeterminatePath
    }
    if (acc.remainingLength <= 0) {
      return acc
    }
    if (idx) {
      if (data.lengths[idx] > acc.remainingLength) {
        return {...acc, remainingLength: 0, coordinates: [...acc.coordinates, stopAtLength(arr[idx-1], [x, y], acc.remainingLength / data.lengths[idx])]}
      }
      return {...acc, remainingLength: acc.remainingLength - data.lengths[idx], coordinates: [...acc.coordinates, [x, y]]}
    }
    return acc
  }, {remainingLength: maxLength, coordinates: []})

  return {...data, coordinates}
}


const defaultProps = {
  ...PathLayer.defaultProps,
  ...ArrowLayer.defaultProps,
  speed: .01
};

const initialCoeff = 0.001;

class ArrowPathLayer extends CompositeLayer {
  constructor(props: any) {
    super(props)
  }

  shouldUpdateState({changeFlags}: {changeFlags: any}) {
    if (changeFlags.propsChanged || changeFlags.dataChanged || changeFlags.stateChanged) {
      return true;
    }

    return false;
  }

  initializeState() {
    super.initializeState()
    const {data}: {data: PathData[]} = this.props;
    const dataWithLengths = data.map(findLengths)
    this.setState({coeff: initialCoeff, fullPathData: dataWithLengths, pathData: dataWithLengths.map(resetPath)})
    this.animate()
  }

  animate() {
    let {coeff, fullPathData} = this.state
    const {speed, animateEvery} = this.props;
	  const animationInterval = setInterval(()=> {
      coeff += speed;

      if (coeff >= 1.0) {
        clearInterval(animationInterval)
        setTimeout(() => {
          this.setState({
            coeff: initialCoeff,
            pathData: fullPathData.map(resetPath)
          })
          this.animate()
        }, animateEvery || 3000)
      }

      const newPathData = fullPathData.map((path: PathData) => slicePath(path, coeff))

      this.setState({
        coeff,
        pathData: newPathData
      })
    }, 30);
  }

  renderLayers() {
    const {getEnd, getPath, getColor, getWidth, getRotation} = this.props
    const {pathData} = this.state;

    return [
      new ArrowLayer(this.getSubLayerProps({
        id: "arrow",
        data: pathData,
        getEnd,
        getColor,
        getWidth,
        getRotation,
        updateTriggers: {
          getEnd: [pathData],
          getColor: [pathData],
          getWidth: [pathData],
          getRotation: [pathData]
        }
      })),
      new PathLayer(this.getSubLayerProps({
        id: "path",
        data: pathData,
        getPath,
        getColor,
        getWidth,
        updateTriggers: {
          getPath: [pathData]
        }
      }))
    ];
  }
}

ArrowPathLayer.layerName = 'ArrowPathLayer';
ArrowPathLayer.defaultProps = defaultProps;

export default ArrowPathLayer
