import * as THREE from 'three'
import { range, max } from 'lodash-es'

const temp = new THREE.Vector3()

function angleForFace(
    face: { a: number; b: number; c: number },
    geometry: THREE.BufferGeometry,
    obj: THREE.Mesh,
    cameraPos: THREE.Vector3,
): number {
    const pos = geometry.attributes.position
    temp.set(
        (pos.getX(face.a) + pos.getX(face.b) + pos.getX(face.c)) / 3,
        (pos.getY(face.a) + pos.getY(face.b) + pos.getY(face.c)) / 3,
        (pos.getZ(face.a) + pos.getZ(face.b) + pos.getZ(face.c)) / 3,
    )
    obj.localToWorld(temp)
    return THREE.MathUtils.radToDeg(Math.atan2(temp.z - cameraPos.z, temp.x - cameraPos.x))
}

function getAngleCounts(scene: THREE.Object3D, cameraPos: THREE.Vector3): number[] {
    const angleCounts = range(0, 360).map(() => 0)
    scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return
        const { geometry } = obj
        if (!geometry.index) return

        const index = geometry.index
        for (let i = 0; i < index.count; i += 3) {
            const face = { a: index.getX(i), b: index.getX(i + 1), c: index.getX(i + 2) }
            let angleDegs = angleForFace(face, geometry, obj, cameraPos)
            angleDegs = Math.floor((360 + angleDegs) % 360)
            angleCounts[angleDegs]++
        }
    })
    return angleCounts
}

export function convolve(xs: number[], kernel: number[][]): number[] {
    const out = xs.map(() => 0)
    const n = xs.length
    xs.forEach((_v, i) => {
        let value = 0
        kernel.forEach(([dx, coeff]) => {
            value += coeff * xs[(i + dx + n) % n]
        })
        out[i] = value
    })
    return out
}

function makeGaussianKernel(width: number, sigma: number): number[][] {
    const kernel: number[][] = []
    for (let dx = Math.ceil(-width / 2); dx < Math.ceil(width / 2); dx++) {
        kernel.push([dx, Math.exp((-dx * dx) / (2 * sigma * sigma))])
    }
    return kernel
}

function findBusiestAngle(angleCounts: number[], fieldOfView: number): number {
    const kernel = makeGaussianKernel(fieldOfView, fieldOfView / 2)
    const windowedCounts = convolve(angleCounts, kernel)
    const m = max(windowedCounts)!
    return windowedCounts.indexOf(m)
}

export function pointCameraAtScene(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const { position, fov } = camera
    const angleCounts = getAngleCounts(scene, position)
    const cameraAngle = findBusiestAngle(angleCounts, fov)
    console.log('Camera auto-angle:', cameraAngle)

    const { x, y, z } = position
    const groundCenter = new THREE.Vector3(x, 0, z)
    const theta = THREE.MathUtils.degToRad(180 + cameraAngle)
    const phi = THREE.MathUtils.degToRad(60)
    const radius = y
    const offset = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
    )

    camera.position.addVectors(groundCenter, offset)
    camera.lookAt(groundCenter)
}
