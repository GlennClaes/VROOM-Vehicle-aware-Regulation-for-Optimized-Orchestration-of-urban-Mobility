import { flatMap, map } from 'lodash-es'
import type { Object3DLoaderParam, SupportedVehicle } from './types/api'

const OGA_COLORS = ['blue', 'citrus', 'green', 'orange', 'red', 'silver', 'violet']
const OGA_TYPES = ['normal', 'hatchback', 'mpv', 'station']
const OGA_SCALE = 2.2

function ogaVehicle(type: string, color: string): Object3DLoaderParam {
    return {
        objectUrl: `vehicles/car-${type}-${color}.obj`,
        materialUrl: `vehicles/car-${type}-${color}.mtl`,
        scale: OGA_SCALE,
    }
}

export const SUPPORTED_VEHICLE_CLASSES: { [sumoVehicleClass: string]: SupportedVehicle } = {
    passenger: {
        label: 'car',
        models: flatMap(OGA_TYPES, (type) => map(OGA_COLORS, (color) => ogaVehicle(type, color))),
    },
    bicycle: {
        label: 'bike',
        models: [{ objectUrl: `vehicles/bicycle.obj`, materialUrl: `vehicles/bicycle.png` }],
    },
    rail: {
        label: 'train',
        models: [{ objectUrl: `vehicles/Streetcar.obj`, materialUrl: `vehicles/Streetcar.png` }],
    },
    pedestrian: {
        label: 'person',
        models: [
            { objectUrl: `vehicles/pedestrian.obj`, materialUrl: `vehicles/pedestrian.png` },
            { objectUrl: `vehicles/pedestrian_male.obj`, materialUrl: `vehicles/pedestrian_male.png` },
        ],
    },
    bus: {
        label: 'bus',
        models: [{ objectUrl: `vehicles/bus.obj`, materialUrl: `vehicles/bus.png` }],
    },
}
