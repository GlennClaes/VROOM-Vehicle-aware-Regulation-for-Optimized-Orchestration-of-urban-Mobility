import * as THREE from 'three'
import { isEmpty } from 'lodash-es'
import { updateKeyStateWithEvent, KEY_CODES, KEY_STATE } from './key-tracker'
import { createXAxisRotationMatrix4, rotateInWorldSpace } from './utils'

const VELOCITY = 5
const VELOCITY_RAD = THREE.MathUtils.degToRad(VELOCITY)
const UP_ROTATE = createXAxisRotationMatrix4(VELOCITY_RAD)
const DOWN_ROTATE = createXAxisRotationMatrix4(-VELOCITY_RAD)

const ROTATE_SPEED = 0.5
const MIN_POLAR_ANGLE = 0.1 // Prevent North Pole gimbal lock
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.05 // Prevent ground clipping
const EPSILON = 0.000001
const ZOOM_SPEED = 1.0

enum State {
    NONE,
    PANNING,
    ROTATING,
}

export default class PanAndRotateControls {
    camera: THREE.PerspectiveCamera
    element: HTMLElement
    state: State = State.NONE
    groundPlane: THREE.Object3D

    // Smooth Transition State
    private currentTarget: THREE.Vector3 = new THREE.Vector3()
    private nextTarget: THREE.Vector3 = new THREE.Vector3()
    private isTargetStable: boolean = true

    // Orbital State
    private theta: number = 0 // horizontal
    private phi: number = Math.PI / 4 // vertical
    private radius: number = 100

    private panStart: THREE.Vector3 = new THREE.Vector3()

    private _onKeyDown: (e: KeyboardEvent) => void
    private _onMouseDown: (e: MouseEvent) => void
    private _onMouseMove: (e: MouseEvent) => void
    private _onMouseUp: (e: MouseEvent) => void
    private _onMouseWheel: (e: WheelEvent) => void

    constructor(
        camera: THREE.PerspectiveCamera,
        mouseElement: HTMLElement,
        groundPlane: THREE.Object3D,
        initialTarget?: THREE.Vector3
    ) {
        this.camera = camera
        this.element = mouseElement
        this.groundPlane = groundPlane

        if (initialTarget) {
            this.currentTarget.copy(initialTarget);
            this.nextTarget.copy(initialTarget);
        }

        // Initialize from current camera position
        this.syncStateFromCamera();

        this._onKeyDown = this.onKeyDown.bind(this)
        this._onMouseDown = this.onMouseDown.bind(this)
        this._onMouseMove = this.onMouseMove.bind(this)
        this._onMouseUp = this.onMouseUp.bind(this)
        this._onMouseWheel = this.onMouseWheel.bind(this)

        mouseElement.addEventListener('keydown', this._onKeyDown)
        mouseElement.addEventListener('mousedown', this._onMouseDown)
        mouseElement.addEventListener('wheel', this._onMouseWheel, { passive: false })

        mouseElement.oncontextmenu = () => false
    }

    private syncStateFromCamera() {
        const offset = this.camera.position.clone().sub(this.currentTarget);
        this.radius = offset.length();
        if (this.radius < EPSILON) this.radius = 10;

        this.theta = Math.atan2(offset.x, offset.z);
        this.phi = Math.atan2(Math.sqrt(offset.x ** 2 + offset.z ** 2), offset.y);

        // Clamp phi to prevent flips
        this.phi = Math.max(MIN_POLAR_ANGLE, Math.min(MAX_POLAR_ANGLE, this.phi));
    }

    dispose() {
        this.element.removeEventListener('keydown', this._onKeyDown)
        this.element.removeEventListener('mousedown', this._onMouseDown)
        this.element.removeEventListener('wheel', this._onMouseWheel)
    }

    private onKeyDown(event: KeyboardEvent) {
        updateKeyStateWithEvent(event)
        if (event.altKey || event.shiftKey) return

        const { keyCode } = event
        const { UP, DOWN, LEFT, RIGHT } = KEY_CODES
        const isArrow = [UP, DOWN, LEFT, RIGHT].includes(keyCode)
        const handled = event.ctrlKey
            ? isArrow
            : isArrow ||
            [KEY_CODES.H, KEY_CODES.A, KEY_CODES.L, KEY_CODES.D,
                KEY_CODES.K, KEY_CODES.W, KEY_CODES.J, KEY_CODES.S].includes(keyCode)

        if (handled) event.preventDefault()
    }

    private onMouseWheel(event: WheelEvent) {
        event.preventDefault()
        this.zoom(event.deltaY)
    }

    zoom(delta: number) {
        // Zoom affects the target radius in our orbital model
        const zoomStep = delta * (this.radius / 1000);
        this.radius = Math.max(5, Math.min(20000, this.radius + zoomStep));
    }

    private getGroundCoords(x: number, y: number): THREE.Vector3 | null {
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera)
        const intersections: THREE.Intersection[] = []
        this.groundPlane.raycast(raycaster, intersections)
        return intersections.length === 1 ? intersections[0].point : null
    }

    private getGroundCoordsForEvent(event: MouseEvent): THREE.Vector3 | null {
        // Use precision offsets for perfect cursor alignment
        const rect = this.element.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        return this.getGroundCoords(x, y);
    }

    private onMouseDown(event: MouseEvent) {
        this.element.focus();

        if (event.button === THREE.MOUSE.LEFT) {
            const panStart = this.getGroundCoordsForEvent(event);
            if (panStart) {
                this.state = State.PANNING;
                this.panStart = panStart.clone();
            }
        } else if (event.button === THREE.MOUSE.RIGHT) {
            // FIXED: Do NOT move the target to the click point per user request.
            // Keeping the focus stable at the current target.
            this.state = State.ROTATING;
            this.nextTarget.copy(this.currentTarget);
            this.isTargetStable = true;

            // GRAB: Set pointer capture so we don't lose the drag outside the window
            try {
                const element = this.element as any;
                if (element.setPointerCapture) {
                    element.setPointerCapture(event.pointerId || 0);
                }
            } catch (e) { /* ignore if not supported */ }
        } else {
            return;
        }

        window.addEventListener('mousemove', this._onMouseMove)
        window.addEventListener('mouseup', this._onMouseUp)
    }

    private onMouseMove(event: MouseEvent) {
        if (this.state === State.PANNING) {
            const currentPoint = this.getGroundCoordsForEvent(event);
            if (currentPoint) {
                const delta = new THREE.Vector3().subVectors(this.panStart, currentPoint);
                this.camera.position.add(delta);
                this.currentTarget.add(delta);
                this.nextTarget.add(delta);
            }
        } else if (this.state === State.ROTATING) {
            const { clientWidth, clientHeight } = this.element;

            // Movement results in direct change of orbital angles
            // This is "state-based" and immune to camera orientation glitches
            const deltaX = (event.movementX || 0) / clientWidth;
            const deltaY = (event.movementY || 0) / clientHeight;

            this.theta -= deltaX * Math.PI * 2 * ROTATE_SPEED;
            this.phi -= deltaY * Math.PI * ROTATE_SPEED; // INVERTED per user feedback

            // Clamp vertical rotation
            this.phi = Math.max(MIN_POLAR_ANGLE, Math.min(MAX_POLAR_ANGLE, this.phi));
        }
    }

    private onMouseUp(_event: MouseEvent) {
        if (this.state === State.ROTATING) {
            try {
                this.element.releasePointerCapture((_event as any).pointerId || 0);
            } catch (e) { }
        }

        this.state = State.NONE;
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
    }

    update() {
        // 1. Handle Smooth Pivot Translation (Lerp)
        if (!this.isTargetStable) {
            const lerpFactor = 0.2; // Quick but smooth glide
            this.currentTarget.lerp(this.nextTarget, lerpFactor);
            if (this.currentTarget.distanceTo(this.nextTarget) < 0.1) {
                this.currentTarget.copy(this.nextTarget);
                this.isTargetStable = true;
            }
        }

        // 2. Update Camera Position from Orbital State
        const offset = new THREE.Vector3(
            this.radius * Math.sin(this.phi) * Math.sin(this.theta),
            this.radius * Math.cos(this.phi),
            this.radius * Math.sin(this.phi) * Math.cos(this.theta)
        );

        this.camera.position.copy(this.currentTarget).add(offset);
        this.camera.lookAt(this.currentTarget);

        // 3. Handle Keyboard Movement
        if (isEmpty(KEY_STATE)) return;

        const ctrl = KEY_STATE[KEY_CODES.CTRL];
        const alt = KEY_STATE[KEY_CODES.ALT];
        const shift = KEY_STATE[KEY_CODES.SHIFT];
        if (alt || shift) return;

        if (ctrl) {
            if (KEY_STATE[KEY_CODES.UP]) this.currentTarget.y += VELOCITY;
            if (KEY_STATE[KEY_CODES.DOWN]) this.currentTarget.y -= VELOCITY;
        } else {
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            dir.y = 0;
            dir.normalize();

            if (KEY_STATE[KEY_CODES.H] || KEY_STATE[KEY_CODES.A]) {
                const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
                const step = right.multiplyScalar(VELOCITY);
                this.currentTarget.add(step);
            }
            if (KEY_STATE[KEY_CODES.L] || KEY_STATE[KEY_CODES.D]) {
                const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
                const step = right.multiplyScalar(-VELOCITY);
                this.currentTarget.add(step);
            }
            if (KEY_STATE[KEY_CODES.K] || KEY_STATE[KEY_CODES.W]) {
                const step = dir.clone().multiplyScalar(VELOCITY);
                this.currentTarget.add(step);
            }
            if (KEY_STATE[KEY_CODES.J] || KEY_STATE[KEY_CODES.S]) {
                const step = dir.clone().multiplyScalar(-VELOCITY);
                this.currentTarget.add(step);
            }

            // Key rotation also modifies state
            if (KEY_STATE[KEY_CODES.LEFT]) this.theta += VELOCITY_RAD;
            if (KEY_STATE[KEY_CODES.RIGHT]) this.theta -= VELOCITY_RAD;
            if (KEY_STATE[KEY_CODES.UP]) this.phi = Math.max(MIN_POLAR_ANGLE, this.phi - VELOCITY_RAD);
            if (KEY_STATE[KEY_CODES.DOWN]) this.phi = Math.min(MAX_POLAR_ANGLE, this.phi + VELOCITY_RAD);
        }

        // Ensure nextTarget stays synced with key-based movement
        this.nextTarget.copy(this.currentTarget);
    }
}
