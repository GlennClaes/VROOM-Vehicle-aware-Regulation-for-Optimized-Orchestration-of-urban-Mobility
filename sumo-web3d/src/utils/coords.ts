import proj4 from 'proj4'
import type { Network } from '../types/api'

export interface LatLng {
    lat: number
    lng: number
}

export interface Transform {
    left: number
    top: number
    bottom: number
    right: number
    width(): number
    height(): number
    xyToXz(xy: number[]): [number, number]
    xyToXyz(xy: number[]): [number, number, number]
    xzToSumoXy(xz: number[]): [number, number]
    sumoXyzToXyz(xyz: number[]): [number, number, number]
    center(): [number, number]
    latLngToXZ(latLng: LatLng): [number, number] | null
    toLatLng(xz: number[]): LatLng | null
}

export function getTransforms(network: Network): Transform {
    const location = network.net.location
    const [dx, dy] = location.netOffset.split(',').map(Number)
    const [left, top, right, bottom] = location.convBoundary.split(',').map(Number)
    const { projParameter } = location

    const t: Transform = {
        left,
        top,
        bottom,
        right,

        xyToXz([x, y]: number[]): [number, number] {
            return [x, bottom - y]
        },

        xyToXyz(xy: number[]): [number, number, number] {
            const x = xy[0]
            const y = xy[1]
            const z = xy[2] ?? 0
            return [x, z, bottom - y]
        },

        center(): [number, number] {
            return [(left + right) / 2, (top + bottom) / 2]
        },

        width(): number {
            return Math.abs(right - left)
        },

        height(): number {
            return Math.abs(bottom - top)
        },

        sumoXyzToXyz([x, y, z]: number[]): [number, number, number] {
            const [xp, , zp] = this.xyToXyz([x, y])
            return [xp, z, zp]
        },

        xzToSumoXy([x, z]: number[]): [number, number] {
            return [x, bottom - z]
        },

        latLngToXZ(latLng: LatLng): [number, number] | null {
            if (projParameter === '!') return null
            const [x, y] = proj4(projParameter, 'WGS84').inverse([latLng.lng, latLng.lat])
            return this.xyToXz([x + dx, y + dy])
        },

        toLatLng(xz: number[]): LatLng | null {
            if (projParameter === '!') return null
            const [sumoX, sumoY] = t.xzToSumoXy(xz)
            const projX = sumoX - dx
            const projY = sumoY - dy
            const [lng, lat] = proj4(projParameter, 'WGS84').forward([projX, projY])
            return { lat, lng }
        },
    }

    return t
}
