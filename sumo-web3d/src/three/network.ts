import * as THREE from 'three'
import { keyBy, mapValues, meanBy } from 'lodash-es'

import type {
    AdditionalResponse,
    BusStop,
    Edge,
    Lane,
    Network,
    Polygon,
    Type,
} from '../types/api'
import type { Transform } from '../utils/coords'
import { offsetLineSegment, pointAlongPolyline } from '../utils/geometry'
import * as materials from './materials'
import { parseShape } from '../utils/sumo-utils'
import {
    extrudedMeshFromVertices,
    featureToGeometry,
    flatMeshFromVertices,
    flatRectMesh,
    lineString,
} from './three-utils'
import { forceArray, makeLookup, type FeatureCollection } from '@/utils'

const DEFAULT_LANE_WIDTH_M = 3.2
const LEVEL_HEIGHT_METERS = 3

enum VehicleClass {
    PASSENGER = 'passenger',
    RAIL_ELECTRIC = 'rail_electric',
    RAIL = 'rail',
    RAIL_URBAN = 'rail_urban',
    TRAM = 'tram',
    PEDESTRIAN = 'pedestrian',
    BICYCLE = 'bicycle',
}

interface ClassLookup {
    [vehicleClass: string]: boolean
}

export interface MeshAndPosition {
    mesh: THREE.Mesh
    position: THREE.Vector3 | null
}

export interface OsmIdToMesh {
    [osmId: string]: MeshAndPosition[]
}

function isRailway(allowed: ClassLookup): boolean {
    return (
        !!(
            allowed[VehicleClass.RAIL_ELECTRIC] ||
            allowed[VehicleClass.RAIL] ||
            allowed[VehicleClass.RAIL_URBAN] ||
            allowed[VehicleClass.TRAM]
        ) && !allowed[VehicleClass.PASSENGER]
    )
}

function getMeshCenter(mesh: THREE.Mesh): THREE.Vector3 | null {
    mesh.geometry.computeBoundingBox()
    if (!mesh.geometry.boundingBox) return null
    return mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
}

function indexAllowedClasses(allow?: string): ClassLookup {
    return makeLookup((allow || '').split(' '))
}

function laneToMaterial(
    type: Type | undefined,
    allowed: ClassLookup,
    edge: Edge,
    lane: Lane,
): THREE.Material {
    if (edge.function === 'crossing') return materials.CROSSING
    if (lane.allow?.includes('pedestrian')) return materials.WALKWAY
    if (lane.allow?.includes('bicycle')) return materials.CYCLEWAY
    if (type?.allow === 'pedestrian') return materials.WALKWAY
    if (type?.allow === 'bicycle') return materials.CYCLEWAY
    if (isRailway(allowed)) return materials.RAILWAY
    return materials.ROAD
}

// ── Static scene ─────────────────────────────────────────────────────────────

export function makeStaticObjects(
    network: Network,
    additionalResponse: AdditionalResponse | null,
    lakes: FeatureCollection | null,
    t: Transform,
): [THREE.Group, OsmIdToMesh] {
    const group = new THREE.Group()
    const osmIdToMeshes: OsmIdToMesh = {}

    const [left, top, right, bottom] = network.net.location.convBoundary.split(',').map(Number)

    // Land
    const bgMesh = flatRectMesh({ left, top, right, bottom }, materials.LAND)
    bgMesh.name = 'Land'
    bgMesh.receiveShadow = false; // Shadow maps disabled for 60fps
    group.add(bgMesh)


    // Edges
    const idToType = keyBy(network.net.type || [], 'id')
    const idToAllowed = mapValues(idToType, (t2) => indexAllowedClasses(t2.allow))

    for (const edge of network.net.edge) {
        if (edge.function === 'internal' || edge.function === 'walkingarea') continue
        const edgeType = idToType[edge.type ?? '']
        const allowed = idToAllowed[edge.type ?? ''] ?? {}

        for (const lane of forceArray(edge.lane)) {
            const coords = parseShape(lane.shape)
            const width = lane.width ? Number(lane.width) : DEFAULT_LANE_WIDTH_M

            // Draw a full-width white base to act as lane markings
            const baseGeo = lineString(coords, t, { width, uScaleFactor: 1 })
            const baseMesh = new THREE.Mesh(baseGeo, materials.LANE_MARKING)
            baseMesh.receiveShadow = false;
            group.add(baseMesh)

            // Draw the actual road surface slightly smaller (0.15m smaller) to expose the white markings
            const roadWidth = Math.max(0.5, width - 0.2)
            const geo = lineString(coords, t, { width: roadWidth, uScaleFactor: 1 })
            const mat = laneToMaterial(edgeType, allowed, edge, lane)
            const mesh = new THREE.Mesh(geo, mat)
            mesh.receiveShadow = false
            mesh.position.y += 0.05 // raise slightly to prevent z-fighting
            mesh.userData = {
                type: 'edge',
                name: `Edge ${edge.id}, Lane ${lane.id}`,
                osmId: { id: edge.id, type: 'way' },
            }
            group.add(mesh)
            const mp: MeshAndPosition = { mesh, position: getMeshCenter(mesh) }
            osmIdToMeshes[edge.id] = osmIdToMeshes[edge.id]
                ? [...osmIdToMeshes[edge.id], mp]
                : [mp]
            osmIdToMeshes[lane.id] = [mp]
        }
    }

    // Junctions
    for (const junction of network.net.junction) {
        if (junction.type === 'internal') continue
        const points = parseShape(junction.shape).map((pt) => t.xyToXz(pt))
        if (points.length < 4) continue
        try {
            const jMesh = flatMeshFromVertices(points, materials.JUNCTION)
            if (junction.z) jMesh.position.setY(Number(junction.z))
            jMesh.receiveShadow = true
            jMesh.userData = {
                type: 'junction',
                name: `Junction ${junction.id}`,
                osmId: { id: junction.id, type: 'node' },
            }
            group.add(jMesh)
            const avgX = meanBy(points, (p) => p[0])
            const avgZ = meanBy(points, (p) => p[1])
            osmIdToMeshes[junction.id] = [
                { mesh: jMesh, position: new THREE.Vector3(avgX, 0, avgZ) },
            ]
        } catch {
            // skip malformed junctions
        }
    }

    // Water / lakes
    if (lakes) {
        for (const feature of lakes.features) {
            const geometry = feature.geometry as any
            if (geometry && geometry.coordinates) {
                geometry.coordinates.forEach((c: number[][]) => {
                    for (let i = 0; i < c.length; i++) {
                        c[i] = t.xyToXz(c[i]) as unknown as number[]
                    }
                })
            }
            const waterGeo = featureToGeometry(feature as any)
            const waterMesh = new THREE.Mesh(waterGeo, materials.WATER)
            waterMesh.rotation.set(Math.PI / 2, 0, 0)
            waterMesh.userData.name = 'Water'
            waterMesh.receiveShadow = true
            group.add(waterMesh)
        }
    }

    // Additional: bus stops & polygons
    if (additionalResponse) {
        if (additionalResponse.busStop) {
            const idToLane: { [laneId: string]: Lane } = {}
            for (const edge of network.net.edge) {
                for (const lane of forceArray(edge.lane)) {
                    idToLane[lane.id] = lane
                }
            }
            for (const busStop of additionalResponse.busStop) {
                const lane = idToLane[busStop.lane]
                if (!lane) continue
                try {
                    const stopMesh = makeBusStop(busStop, lane, t)
                    group.add(stopMesh)
                    osmIdToMeshes[busStop.id] = [{ mesh: stopMesh, position: getMeshCenter(stopMesh) }]
                } catch {
                    // skip
                }
            }
        }

        if (additionalResponse.poly) {
            for (const polygon of additionalResponse.poly) {
                if (polygon.type !== 'building') continue
                try {
                    const bMesh = makeBuilding(polygon, t)
                    if (bMesh) {
                        group.add(bMesh)
                        osmIdToMeshes[polygon.id] = [{ mesh: bMesh, position: getMeshCenter(bMesh) }]
                    }
                } catch {
                    // skip
                }
            }
        }
    }

    return [group, osmIdToMeshes]
}

function makeBusStop(busStop: BusStop, lane: Lane, t: Transform): THREE.Mesh {
    const shape = parseShape(lane.shape)
    const start = pointAlongPolyline(shape, Number(busStop.startPos))
    let end: number[]
    try {
        end = pointAlongPolyline(shape, Number(busStop.endPos))
    } catch {
        end = shape[shape.length - 1]
    }
    const laneWidth = Number(lane.width || DEFAULT_LANE_WIDTH_M)
    const xys = offsetLineSegment([start, end], laneWidth / 2)
    const geo = lineString(xys, t, { width: laneWidth / 2 })
    const mesh = new THREE.Mesh(geo, materials.BUS_STOP)
    mesh.userData = { type: 'busstop', name: `Bus Stop ${busStop.id}; Lines: ${busStop.lines}` }
    return mesh
}

function makeBuilding(polygon: Polygon, t: Transform): THREE.Mesh | null {
    const coords = parseShape(polygon.shape)
    const xzCoords = coords.map((pt) => t.xyToXz(pt))
    const params = forceArray(polygon.param || [])
    let numLevels = 1
    for (const param of params) {
        if (param.key === 'building:levels') numLevels = Number(param.value)
    }
    try {
        const obj = extrudedMeshFromVertices(
            xzCoords,
            (numLevels + 0.5) * LEVEL_HEIGHT_METERS,
            0.25,
            0.1,
            [materials.BUILDING_TOP, materials.BUILDING_SIDE],
        )
        obj.userData = {
            type: 'poi',
            name: `POI ${polygon.id}`,
            osmId: { id: polygon.id, type: 'way' },
        }
        obj.castShadow = true
        obj.receiveShadow = true
        return obj
    } catch {
        return null
    }
}
