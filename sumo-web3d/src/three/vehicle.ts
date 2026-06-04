import * as THREE from 'three'
import stringHash from 'string-hash'
import { Signals, type VehicleInfo } from '../types/api'

const SHOW_LIGHTS = false

const OFFSET_X = 0.8
const OFFSET_Y = 0.644
const OFFSET_Z_FRONT = 1.8
const OFFSET_Z_BACK = -2.0
const BRAKE_LIGHT_COLOR = 0xff0000
const SIGNAL_LIGHT_COLOR = 0x0000ff

export default class Vehicle {
    public vehicleInfo: VehicleInfo
    public mesh: THREE.Group | THREE.Mesh | THREE.Object3D

    static fromInfo(
        vClassObjects: { [vClass: string]: THREE.Object3D[] },
        vehicleId: string,
        info: VehicleInfo,
    ): Vehicle | null {
        const objects = vClassObjects[info.vClass]
        if (!objects) {
            console.warn(`Unsupported vehicle type: ${info.vClass}`)
            return null
        }
        const randomModelIndex = stringHash(vehicleId) % objects.length
        const mesh = objects[randomModelIndex].clone()
        return new Vehicle(mesh, vehicleId, info)
    }

    private constructor(mesh: THREE.Object3D, vehicleId: string, info: VehicleInfo) {
        mesh.name = vehicleId
        mesh.userData = { type: info.type, vClass: info.vClass }

        if (info.vClass === 'passenger' && SHOW_LIGHTS) {
            this.setupLights(mesh.userData, mesh)
        }

        this.vehicleInfo = info
        this.mesh = mesh
    }

    private addLight(
        mesh: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        lightColor: number,
    ): THREE.Mesh {
        const sphereGeom = new THREE.SphereGeometry(0.12, 24, 24)
        const material = new THREE.MeshBasicMaterial({ color: lightColor, transparent: false })
        const light = new THREE.Mesh(sphereGeom, material)
        light.position.set(x, y, z)
        mesh.add(light)
        return light
    }

    private setupLights(userData: Record<string, unknown>, mesh: THREE.Object3D) {
        userData['leftFrontLight'] = this.addLight(mesh, -OFFSET_X, OFFSET_Y, OFFSET_Z_FRONT, SIGNAL_LIGHT_COLOR)
        userData['leftBackLight'] = this.addLight(mesh, OFFSET_X, OFFSET_Y, OFFSET_Z_BACK, BRAKE_LIGHT_COLOR)
        userData['rightFrontLight'] = this.addLight(mesh, OFFSET_X, OFFSET_Y, OFFSET_Z_FRONT, SIGNAL_LIGHT_COLOR)
        userData['rightBackLight'] = this.addLight(mesh, -OFFSET_X, OFFSET_Y, OFFSET_Z_BACK, BRAKE_LIGHT_COLOR)
    }

    setSignals(signals: number) {
        if (!SHOW_LIGHTS) return
        const isBraking = signals & Signals.BRAKE
        const { userData } = this.mesh
        ;(userData['leftBackLight'] as THREE.Mesh).visible = !!isBraking
        ;(userData['rightBackLight'] as THREE.Mesh).visible = !!isBraking
        ;(userData['leftFrontLight'] as THREE.Mesh).visible = !!(signals & Signals.LEFT)
        ;(userData['rightFrontLight'] as THREE.Mesh).visible = !!(signals & Signals.RIGHT)
    }
}
