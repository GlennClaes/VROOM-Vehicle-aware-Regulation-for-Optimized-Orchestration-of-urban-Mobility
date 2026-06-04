import * as THREE from 'three'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import type { Transform } from '../utils/coords'
import { findClosestPoint, polylineDistance } from '../utils/geometry'
import type { Feature } from '../utils/index'

// ── Shape helpers ───────────────────────────────────────────────────────────

function shapeFromVertices(vertices: number[][]): THREE.Shape {
    const shape = new THREE.Shape()
    shape.moveTo(vertices[0][0], vertices[0][1])
    for (let i = 1; i < vertices.length; i++) {
        shape.lineTo(vertices[i][0], vertices[i][1])
    }
    shape.closePath()
    return shape
}

// ── UV helpers ──────────────────────────────────────────────────────────────

function addUVMappingToGeometry(geometry: THREE.BufferGeometry) {
    geometry.computeBoundingBox()
    const bb = geometry.boundingBox!
    const offsetX = -bb.min.x
    const offsetY = -bb.min.y
    const rangeX = bb.max.x - bb.min.x || 1
    const rangeY = bb.max.y - bb.min.y || 1

    const pos = geometry.attributes.position
    const uvs: number[] = []
    for (let i = 0; i < pos.count; i++) {
        uvs.push((pos.getX(i) + offsetX) / rangeX, (pos.getY(i) + offsetY) / rangeY)
    }
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
}

// ── Mesh constructors ───────────────────────────────────────────────────────

export function flatMeshFromVertices(
    vertices: number[][],
    material: THREE.Material,
): THREE.Mesh {
    const shape = shapeFromVertices(vertices)
    const geometry = new THREE.ShapeGeometry(shape)
    addUVMappingToGeometry(geometry)

    const mesh = new THREE.Mesh(geometry, material)
    ;(mesh.material as THREE.Material & { side: THREE.Side }).side = THREE.DoubleSide
    mesh.rotation.set(Math.PI / 2, 0, 0)
    return mesh
}

export function flatRectMesh(
    { top, left, right, bottom }: { top: number; left: number; right: number; bottom: number },
    material: THREE.Material,
): THREE.Mesh {
    return flatMeshFromVertices(
        [
            [left, top],
            [right, top],
            [right, bottom],
            [left, bottom],
        ],
        material,
    )
}

export function extrudedMeshFromVertices(
    vertices: number[][],
    height: number,
    _topBottomUVScale: number,
    _sideUVScale: number,
    mats: THREE.Material[],
): THREE.Mesh {
    const shape = shapeFromVertices(vertices)
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false,
    })
    addUVMappingToGeometry(geometry)

    // Groups: ExtrudeGeometry produces group 0 = front+back, group 1 = sides.
    const mesh = new THREE.Mesh(geometry, mats)
    mesh.rotation.set(Math.PI / 2, 0, 0)
    mesh.position.setY(height)
    return mesh
}

// ── Line string (road/lane geometry) ───────────────────────────────────────

export interface LineParams {
    width: number
    uScaleFactor?: number
}

/**
 * Build a flat ribbon geometry from an array of 2D SUMO points.
 * We approximate the extrude-polyline logic using a simple quad-strip.
 */
export function lineString(
    points: number[][],
    transform: Transform,
    params: LineParams,
): THREE.BufferGeometry {
    const half = params.width / 2
    const vertices: number[] = []
    const indices: number[] = []

    // Convert SUMO xy → three.js xz
    const pts3: [number, number, number][] = points.map((p) => {
        const z = p[2] ?? 0
        return transform.xyToXyz !== undefined
            ? transform.xyToXyz([p[0], p[1]])
            : [p[0], z, transform.bottom - p[1]]
    })

    for (let i = 0; i < pts3.length; i++) {
        const curr = pts3[i]
        const next = pts3[Math.min(i + 1, pts3.length - 1)]
        const prev = pts3[Math.max(i - 1, 0)]

        const dx = next[0] - prev[0]
        const dz = next[2] - prev[2]
        const len = Math.sqrt(dx * dx + dz * dz) || 1
        // Perpendicular in xz-plane
        const px = (-dz / len) * half
        const pz = (dx / len) * half

        vertices.push(curr[0] + px, curr[1], curr[2] + pz)
        vertices.push(curr[0] - px, curr[1], curr[2] - pz)

        if (i < pts3.length - 1) {
            const base = i * 2
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
        }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    // Simple UV along the ribbon
    const uvs: number[] = []
    const uScale = params.uScaleFactor ?? 1
    for (let i = 0; i < pts3.length; i++) {
        uvs.push(i * uScale, 0, i * uScale, 1)
    }
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

    return geometry
}

// ── Merge helper ─────────────────────────────────────────────────────────────

/**
 * Merge src mesh into dst geometry, copying userData onto newly added faces.
 * In modern Three.js we work with BufferGeometry — we keep meshes in a group
 * instead of actually merging, to preserve userData per-mesh.
 */
export function mergeMeshIntoGroup(group: THREE.Group, mesh: THREE.Mesh) {
    group.add(mesh)
}

// ── GeoJSON feature → geometry ───────────────────────────────────────────────

function polygonToShape(coordinates: number[][][]): THREE.Shape {
    const outer = shapeFromVertices(coordinates[0])
    for (let i = 1; i < coordinates.length; i++) {
        outer.holes.push(shapeFromVertices(coordinates[i]))
    }
    return outer
}

export function featureToGeometry(feature: Feature): THREE.BufferGeometry {
    const geom = feature.geometry
    if (geom.type === 'MultiPolygon') {
        const shapes = (geom.coordinates as number[][][][]).map(polygonToShape)
        const g = new THREE.ShapeGeometry(shapes)
        addUVMappingToGeometry(g)
        return g
    } else if (geom.type === 'Polygon') {
        const shape = polygonToShape(geom.coordinates as number[][][])
        const g = new THREE.ShapeGeometry(shape)
        addUVMappingToGeometry(g)
        return g
    } else {
        throw new Error(`Geometry type ${geom.type} not supported.`)
    }
}

// ── OBJ loading ──────────────────────────────────────────────────────────────

const OBJ_LOADER = new OBJLoader()

export function loadOBJFile(
    url: string,
    material?: THREE.Material,
): Promise<THREE.Object3D> {
    return new Promise<THREE.Object3D>((resolve, reject) => {
        OBJ_LOADER.load(
            url,
            (obj) => {
                if (material) setMaterial(obj, material)
                resolve(obj)
            },
            undefined,
            reject,
        )
    })
}

export function setMaterial(obj: THREE.Object3D, material: THREE.Material) {
    obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.material = material
        }
    })
}

// Kept for internal use with polylineDistance
export { findClosestPoint, polylineDistance }
