import * as THREE from 'three'
import { KEY_CODES } from './key-tracker'
import { createYAxisRotationMatrix3 } from './utils'

const ZOOM_SPEED = 0.95

interface PerspectiveVector {
    direction: THREE.Vector3
    length: number
}

function onScroll(vector: PerspectiveVector, event: WheelEvent) {
    const delta = Math.ceil(event.deltaY / 10)
    if (delta > 3 || delta < -3) {
        vector.length *= Math.pow(ZOOM_SPEED, -delta)
    }
}

function createOrbitKeyDown(_angle: number) {
    const leftRotate = createYAxisRotationMatrix3(THREE.MathUtils.degToRad(5))
    const rightRotate = createYAxisRotationMatrix3(THREE.MathUtils.degToRad(-5))

    return (vector: PerspectiveVector, event: KeyboardEvent) => {
        event.preventDefault()
        if (event.keyCode === KEY_CODES.LEFT) {
            vector.direction.applyMatrix3(leftRotate)
        } else if (event.keyCode === KEY_CODES.RIGHT) {
            vector.direction.applyMatrix3(rightRotate)
        } else if (event.keyCode === KEY_CODES.UP) {
            const full = vector.direction.clone().multiplyScalar(vector.length)
            vector.direction = full.setY(full.y + 1).normalize()
        } else if (event.keyCode === KEY_CODES.DOWN) {
            const full = vector.direction.clone().multiplyScalar(vector.length)
            if (full.y - 1 > 0) vector.direction = full.setY(full.y - 1).normalize()
        }
    }
}

function perspToThree(vector: PerspectiveVector): THREE.Vector3 {
    return vector.direction.clone().multiplyScalar(vector.length)
}

export default class FollowVehicleControls {
    camera: THREE.Camera
    object: THREE.Object3D
    vector: PerspectiveVector
    keyboardElement: HTMLElement
    rotationFn: (event: KeyboardEvent) => void
    scrollFn: (event: WheelEvent) => void

    constructor(object: THREE.Object3D, camera: THREE.Camera, keyboardElement: HTMLElement) {
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = 50
            camera.updateProjectionMatrix()
        }
        this.camera = camera
        this.object = object
        this.vector = { direction: new THREE.Vector3(1, 1, 1).normalize(), length: 18 }
        this.keyboardElement = keyboardElement

        const rotateFn = createOrbitKeyDown(5)
        this.rotationFn = rotateFn.bind(null, this.vector)
        this.scrollFn = onScroll.bind(null, this.vector)
        keyboardElement.addEventListener('keydown', this.rotationFn)
        keyboardElement.addEventListener('wheel', this.scrollFn)
    }

    dispose() {
        this.keyboardElement.removeEventListener('keydown', this.rotationFn)
        this.keyboardElement.removeEventListener('wheel', this.scrollFn)
    }

    update() {
        const objectPosition = new THREE.Vector3()
        this.object.getWorldPosition(objectPosition)
        this.camera.position.copy(objectPosition.clone().add(perspToThree(this.vector)))
        this.camera.lookAt(this.object.position)
    }
}
