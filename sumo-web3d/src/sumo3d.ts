import { GUI } from 'dat.gui';
import * as _ from 'lodash';
import Stats from 'stats.js';
import * as three from 'three';

import { AiDecision, LightInfo, SimulationState, VehicleInfo, Network } from './types/api';
import FollowVehicleControls from './controls/follow-controls';
import PanAndRotateControls from './controls/pan-and-rotate-controls';
import { XZPlaneMatrix4 } from './controls/utils';
import { getTransforms, LatLng, Transform } from './three/coords';
import Postprocessing from './three/postprocessing';
import addSky from './three/sky';
import { InitResources } from './initialization';
import { HIGHLIGHT } from './three/materials';
import { SUPPORTED_VEHICLE_CLASSES } from './constants';
import { makeStaticObjects, MeshAndPosition, OsmIdToMesh } from './three/network';
// pointCameraAtScene removed
import TrafficLights from './three/traffic-lights';
import { forceArray } from './utils';
import Vehicle from './three/vehicle';

const { hostname, protocol, port } = window.location;
let targetPort = port;
if (port === '5173') targetPort = '3000';
if (port === '80' || port === '443') targetPort = '';
export const SUMO_ENDPOINT = `${protocol}//${hostname}${targetPort ? ':' + targetPort : ''}/map`;

export interface SumoState {
    time: number;
    payloadSize: number;
    vehicleCounts: { [vClass: string]: number };
    kpis?: {
        avg_speed: number;
        avg_waiting_time: number;
        vehicle_count: number;
        throughput: number;
        intersection_delay?: number;
        pressure?: number;
        ttt?: number;
        nql?: number;
        fairness?: number;
        tp_delay_ratio?: number;
    };
    simulateSecs: number;
    snapshotSecs: number;
    aiDecisions?: AiDecision[];
}

export interface NameAndUserData extends UserData {
    name: string;
}

export interface UserData {
    type: string;
    vClass?: string;
    osmId?: {
        id: number;
        type: 'node' | 'way' | 'relation';
    };
}

export interface SumoParams {
    onClick: (
        point: LatLng | null,
        sumoXY: [number, number] | null,
        objects: NameAndUserData[],
    ) => any;
    onUnfollow: () => any;
    onRemove: (id: string) => any;
    onUnhighlight: () => any;
}

interface HighlightedMesh {
    originalMesh: three.Object3D;
    highlightedMesh: three.Object3D;
}

interface HighlightedVehicle {
    id: string;
    originalMaterial: three.Material;
    vehicle: Vehicle;
}

/**
 * Visualize a Sumo simulation using three.js.
 *
 * This class expects the DOM to be ready and for all its resources to be loaded.
 */
export default class Sumo3D {
    parentElement: HTMLElement;

    public osmIdToMeshes: OsmIdToMesh;
    private transform: Transform;
    private vehicles: { [vehicleId: string]: Vehicle };
    private camera: three.PerspectiveCamera;
    private scene: three.Scene;
    private renderer: three.WebGLRenderer;
    private controls: PanAndRotateControls | FollowVehicleControls;
    public simulationState: SimulationState;
    private vClassObjects: { [vehicleClass: string]: three.Object3D[] };
    private trafficLights: TrafficLights;
    public highlightedMeshes: HighlightedMesh[];
    private highlightedVehicles: HighlightedVehicle[];
    private gui: GUI;
    private postprocessing: Postprocessing;
    private stats: Stats;
    private simTimePanel: Stats.Panel;
    private maxSimTimeMs: number;
    private highlightedRoute: HighlightedMesh[];
    private groundPlane: three.Object3D;
    private cancelNextClick = false;
    private mouseMoveThreshold = 5; // pixels
    private mouseDownPos = { x: 0, y: 0 };
    private resizeObserver: ResizeObserver | null = null;
    private referenceFov: number = 75;
    private referenceAspect: number = 1.33;
    private pendingResize: { width: number, height: number } | null = null;
    private wasFullscreen: boolean = false;
    private exitStabilityTimer: any = null;
    private renderingEnabled: boolean = true;
    private fpsFrameCount = 0;
    private fpsLastTime = 0;
    private lowFpsCount = 0;
    private qualityDegraded = false;

    // ... inside constructor ...

    // Interpolation state
    private lastSnapshotTime: number = 0;
    private snapshotInterval: number = 100; // ms
    private frameTime: number = 0;
    private lastFrameTime: number = 0;

    constructor(parentElement: HTMLElement, init: InitResources, private params: SumoParams) {
        const startMs = window.performance.now();

        this.parentElement = parentElement;
        const width = parentElement.clientWidth;
        const height = parentElement.clientHeight;

        // Fallbacks voor ontbrekende resources
        this.simulationState = init.simulationState || { time: 0, payloadSize: 0, vehicleCounts: {}, simulateSecs: 0, snapshotSecs: 0 };
        const safeNetwork: Network = init.network || { net: { tlLogic: [] }, nodes: [], ways: [] };
        const safeAdditional = init.additional || { tlLogic: [] };
        const safeSettings = init.settings || { viewsettings: { viewport: { x: 0, y: 0, zoom: 1 } } };

        this.transform = getTransforms(safeNetwork);
        this.vClassObjects = init.vehicles || {};
        this.vehicles = {};
        this.highlightedRoute = [];
        this.highlightedMeshes = [];
        this.animate = this.animate.bind(this);
        this.highlightedVehicles = [];

        this.trafficLights = new TrafficLights(init);

        // Renderer setup - limit pixel ratio to 1.5 for a sharp image on Retina/4K displays while maintaining 60 FPS
        this.renderer = new three.WebGLRenderer({ antialias: true });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        (this.renderer as any).setPixelRatio(pixelRatio);
        (this.renderer as any).shadowMap.enabled = false;
        (this.renderer as any).shadowMap.type = three.PCFSoftShadowMap;
        this.renderer.domElement.oncontextmenu = () => false;
        this.renderer.domElement.style.outline = 'none';

        // ISOLATION: Force absolute positioning so the canvas never "pushes" the layout
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';

        this.renderer.setSize(width, height);

        this.scene = new three.Scene();

        // Camera setup
        const safeWidth = width > 0 ? width : 800;
        const safeHeight = height > 0 ? height : 600;
        this.camera = new three.PerspectiveCamera(75, safeWidth / safeHeight, 1, 20000);
        this.referenceFov = 75;
        this.referenceAspect = safeWidth / safeHeight;

        // Default view: Focus on the requested intersection with a cinematic angle
        const INTERSECTION_SUMO = [2309.64, 3106.64];
        const [targetX, , targetZ] = this.transform.xyToXyz(INTERSECTION_SUMO);

        // Zoomed in closer as requested
        const initY = 80;
        this.camera.position.set(targetX - 100, initY, targetZ + 100);
        this.camera.lookAt(targetX, 0, targetZ);
        const initialTarget = new three.Vector3(targetX, 0, targetZ);

        // GUI & sky
        this.gui = new GUI();
        addSky(this.scene, false); // isEditor = false
        this.postprocessing = new Postprocessing(
            this.camera,
            this.scene,
            this.renderer,
            this.gui,
            width,
            height
        );

        // Maak statische objecten veilig aan
        let staticGroup: three.Group;
        [staticGroup, this.osmIdToMeshes] = makeStaticObjects(
            safeNetwork,
            safeAdditional as any,
            init.water as any, // Use init.water directly, as safeWater was removed
            this.transform
        );
        staticGroup.matrixAutoUpdate = false; // Optimization
        staticGroup.updateMatrix();
        this.scene.add(staticGroup);

        // pointCameraAtScene(this.camera, this.scene); // Already disabled

        this.scene.add(this.trafficLights.loadNetwork(safeNetwork, this.transform));
        this.trafficLights.addLogic(forceArray(safeNetwork.net.tlLogic));
        if (safeAdditional.tlLogic) {
            this.trafficLights.addLogic(forceArray(safeAdditional.tlLogic));
        }
        this.trafficLights.initializeDefaultPhases();

        this.groundPlane = this.scene.getObjectByName('Land') as three.Object3D;

        // Bind methods
        this.animate = this.animate.bind(this);
        this.moveCameraTo = this.moveCameraTo.bind(this);
        this.moveCameraToRandomVehicleOfClass = this.moveCameraToRandomVehicleOfClass.bind(this);

        // Scene GUI folder
        const sceneFolder = this.gui.addFolder('Scene');
        const sceneOptions = {
            showGroundPlane: true,
            shadows: false
        };
        sceneFolder.add(sceneOptions, 'showGroundPlane').onChange((v: boolean) => {
            if (this.groundPlane) this.groundPlane.visible = v;
        });
        sceneFolder.add(sceneOptions, 'shadows').onChange((v: boolean) => {
            (this.renderer as any).shadowMap.enabled = v;
            // We need to re-compile materials or just toggle visibility if they are already in scene
            this.scene.traverse((obj) => {
                if ((obj as any).material) (obj as any).material.needsUpdate = true;
            });
        });

        this.gui.hide();

        parentElement.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new PanAndRotateControls(
            this.camera,
            this.renderer.domElement,
            this.groundPlane,
            initialTarget
        );

        // Stats
        this.stats = new Stats();
        this.simTimePanel = this.stats.addPanel(new Stats.Panel('simMs', '#fff', '#777'));
        this.maxSimTimeMs = 0;
        this.stats.showPanel(0);
        parentElement.appendChild(this.stats.dom);
        this.stats.dom.style.position = 'absolute';

        // Event listeners
        this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));

        // FLUID RESIZE SYNC:
        // Use ResizeObserver instead of window resize for zero-latency updates
        this.resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry && entry.contentRect) {
                this.onResize(entry.contentRect.width, entry.contentRect.height);
            }
        });
        this.resizeObserver.observe(parentElement);

        // Start animatie-loop
        this.animate();

        const endMs = window.performance.now();
        console.log('Initialized three.js scene in ', endMs - startMs, ' ms.');
    }

    purgeVehicles() {
        // cleanup scene
        for (const vehId in this.vehicles) {
            this.scene.remove(this.vehicles[vehId].mesh);
        }
        this.vehicles = {};
    }

    // Helper function to bring the state of the object representing the vehicle
    // up to date with its VehicleInfo.
    updateVehicleMesh(vehicle: Vehicle) {
        const v = vehicle.vehicleInfo;
        const [x, y, z] = this.transform.sumoXyzToXyz([v.x, v.y, v.z]);
        const angle = three.MathUtils.degToRad(180 - v.angle);

        const newTarget = new three.Vector3(
            x - v.length / 2 * Math.sin(angle),
            y,
            z - v.length / 2 * Math.cos(angle)
        );

        const vAny = vehicle as any;
        const now = window.performance.now();

        if (vAny.targetPos) {
            // Calculate velocity from position delta / time delta
            const dt = (now - (vAny.targetTimestamp || now)) / 1000;
            if (dt > 0.01 && dt < 2.0) {
                vAny.velocity = new three.Vector3(
                    (newTarget.x - vAny.targetPos.x) / dt,
                    0,
                    (newTarget.z - vAny.targetPos.z) / dt
                );
            }
        }

        vAny.targetPos = newTarget;
        vAny.targetAngle = angle;
        vAny.targetTimestamp = now;

        if (!vAny.prevPos) {
            vAny.prevPos = newTarget.clone();
            vAny.prevAngle = angle;
            vAny.velocity = new three.Vector3(0, 0, 0);
            vehicle.mesh.position.copy(newTarget);
            vehicle.mesh.rotation.y = angle;
        }

        if (v.type === 'passenger') {
            vehicle.setSignals(v.signals);
        }
        vehicle.mesh.visible = !v.vehicle;
    }

    createVehicleObject(vehicleId: string, info: VehicleInfo) {
        const vehicle = Vehicle.fromInfo(this.vClassObjects, vehicleId, info);
        if (vehicle) {
            this.vehicles[vehicleId] = vehicle;
            this.updateVehicleMesh(vehicle);
            this.scene.add(vehicle.mesh);
        }
    }

    updateVehicleObject(vehicleId: string, update: VehicleInfo) {
        const vehicle = this.vehicles[vehicleId];
        if (vehicle) {
            // Before updating, store current mesh state as previous for interpolation
            (vehicle as any).prevPos = (vehicle as any).targetPos?.clone() || vehicle.mesh.position.clone();
            (vehicle as any).prevAngle = (vehicle as any).targetAngle ?? vehicle.mesh.rotation.y;
            (vehicle as any).isStatic = false;

            _.extend(vehicle.vehicleInfo, update);
            this.updateVehicleMesh(vehicle);
        }
    }

    removeVehicleObject(vehicleId: string) {
        let highlightedIndex = -1;
        this.highlightedVehicles.forEach((v, i) => {
            if (v.id === vehicleId) {
                this.highlightByVehicleId(v.id, false);
                highlightedIndex = i;
            }
        });

        if (highlightedIndex !== -1) {
            this.highlightedVehicles.splice(highlightedIndex, 1);
        }

        const vehicle = this.vehicles[vehicleId];
        if (vehicle) {
            this.scene.remove(vehicle.mesh);
            if (
                this.controls instanceof FollowVehicleControls &&
                vehicleId === this.controls.object.name
            ) {
                this.params.onUnfollow();
            }
            this.params.onRemove(vehicleId);
            delete this.vehicles[vehicleId];
        }
    }

    updateLightObject(lightId: string, update: LightInfo) {
        const { programID, phase, state } = update;
        if (programID !== undefined) {
            this.trafficLights.setLightProgram(lightId, programID);
        }
        if (phase !== undefined || state !== undefined) {
            this.trafficLights.setPhase(lightId, phase, state);
        }
    }

    updateStats(stats: SumoState) {
        const now = window.performance.now();
        if (this.lastSnapshotTime > 0) {
            const measuredInterval = now - this.lastSnapshotTime;
            // Moving average to smooth out network jitter (80% old, 20% new)
            this.snapshotInterval = this.snapshotInterval * 0.8 + measuredInterval * 0.2;
        }
        this.lastSnapshotTime = now;

        const simTimeMs = stats.simulateSecs * 1000;
        this.maxSimTimeMs = Math.max(simTimeMs, this.maxSimTimeMs);
        this.simTimePanel.update(simTimeMs, 100);
    }

    animate() {
        if (!this.renderingEnabled) {
            // Keep the loop alive but skip all work
            requestAnimationFrame(this.animate);
            return;
        }

        // Resolve any pending resizes BEFORE rendering this frame
        if (this.pendingResize) {
            this.applyResize(this.pendingResize.width, this.pendingResize.height);
            this.pendingResize = null;
        }

        this.frameTime = window.performance.now();
        
        // Performance Guard: auto-detect low frame rate
        this.fpsFrameCount++;
        if (this.fpsLastTime === 0) {
            this.fpsLastTime = this.frameTime;
        } else {
            const elapsed = this.frameTime - this.fpsLastTime;
            if (elapsed >= 1000) {
                const fps = (this.fpsFrameCount * 1000) / elapsed;
                this.fpsFrameCount = 0;
                this.fpsLastTime = this.frameTime;
                
                if (fps < 15 && !this.qualityDegraded) {
                    this.lowFpsCount++;
                    if (this.lowFpsCount >= 3) {
                        this.degradeQuality();
                    }
                } else {
                    this.lowFpsCount = 0;
                }
            }
        }

        this.interpolateVehicles();
        this.controls.update();
        this.postprocessing.render();
        this.stats.update();

        requestAnimationFrame(this.animate);
    }

    private degradeQuality() {
        this.qualityDegraded = true;
        console.warn("[PerformanceGuard] Low FPS detected (<15 FPS) for 3s. Automatically degrading WebGL quality to restore performance.");
        
        // 1. Drop pixel ratio to 0.75 for fast rendering
        this.renderer.setPixelRatio(0.75);
        this.postprocessing.onResize(this.parentElement.clientWidth, this.parentElement.clientHeight, 0.75);
        
        // 2. Hide buildings and water meshes to reduce draw calls
        this.scene.traverse((obj) => {
            if (obj.userData && (obj.userData.type === 'building' || obj.userData.type === 'water')) {
                obj.visible = false;
            }
        });
    }

    setRenderingEnabled(enabled: boolean) {
        this.renderingEnabled = enabled;
        console.log(`[Sumo3D] Rendering ${enabled ? 'ENABLED' : 'PAUSED'}`);
    }

    isRenderingEnabled(): boolean {
        return this.renderingEnabled;
    }

    interpolateVehicles() {
        const now = window.performance.now();
        if (this.lastFrameTime === 0) {
            this.lastFrameTime = now;
            return;
        }
        const deltaTime = Math.min(0.1, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;

        if (deltaTime <= 0) return;

        // Lower decay factor slightly (e.g. 8.0) for a smoother glide, using velocity prediction
        const lerpFactor = 1.0 - Math.exp(-8.0 * deltaTime);

        for (const id in this.vehicles) {
            const v = this.vehicles[id];
            const vAny = v as any;
            if (vAny.targetPos) {
                const distSq = v.mesh.position.distanceToSquared(vAny.targetPos);
                
                // Snap if it's a teleport or huge jump
                if (distSq > 3600) {
                    v.mesh.position.copy(vAny.targetPos);
                    v.mesh.rotation.y = vAny.targetAngle;
                    continue;
                }

                // Extrapolate position using velocity to predict the current location between server updates
                let currentTarget = vAny.targetPos.clone();
                if (vAny.velocity && vAny.targetTimestamp) {
                    const timeSinceUpdate = (now - vAny.targetTimestamp) / 1000;
                    // Limit prediction time to 1.5 seconds to avoid drifting off track if updates stop
                    if (timeSinceUpdate > 0 && timeSinceUpdate < 1.5) {
                        currentTarget.addScaledVector(vAny.velocity, timeSinceUpdate);
                    }
                }

                // Smoothly interpolate position towards the predicted current target
                v.mesh.position.lerp(currentTarget, lerpFactor);

                // Smoothly interpolate rotation
                let diff = vAny.targetAngle - v.mesh.rotation.y;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                v.mesh.rotation.y += diff * lerpFactor;
            }
        }
    }

    onSelectFollowPOV(vehicleId: string) {
        const vehicle = this.vehicles[vehicleId];
        if (vehicle) {
            const object = vehicle.mesh;
            this.controls.dispose();
            this.controls = new FollowVehicleControls(object, this.camera, document.body);

            // Update reference stats for Follow mode (which uses 50 FOV)
            this.referenceFov = 50;
            this.referenceAspect = this.camera.aspect;

            this.controls.update();
        }
    }

    unfollowPOV() {
        if (this.controls instanceof FollowVehicleControls) {
            // Place camera over vehicle's arrival location
            const translation = new three.Vector3(0, 100, 0);
            this.camera.position.copy(translation.applyMatrix4(this.controls.object.matrix));
            this.controls.dispose();
            this.controls = new PanAndRotateControls(
                this.camera,
                this.renderer.domElement,
                this.groundPlane,
            );
            // Have the camera look out over the horizon
            this.camera.setRotationFromMatrix(XZPlaneMatrix4);

            // Restore reference stats for Pan mode (75 FOV)
            this.camera.fov = 75;
            this.referenceFov = 75;
            this.referenceAspect = this.camera.aspect;
            this.camera.updateProjectionMatrix();
        }
    }

    onShowRouteObject(edgeIds: string[]) {
        this.unhighlightRoute(); // Clear previous route highlights
        this.highlightedRoute = _.flatten(edgeIds.map(id => this.highlightByOsmId(id, false)));
        return;
    }

    /** Point the camera down at some SUMO coordinates. */
    moveCameraTo(sumoX: number, sumoY: number, sumoZ: number) {
        if (!(this.controls instanceof FollowVehicleControls)) {
            const [x, y, z] = this.transform.sumoXyzToXyz([sumoX, sumoY, sumoZ]);
            this.camera.position.set(x, y, z);
        }
    }

    vehicleLabel(vClass: string | number): string {
        return SUPPORTED_VEHICLE_CLASSES[String(vClass)]?.label ?? String(vClass)
    }

    moveCameraToRandomVehicleOfClass(vehicleClass: string) {
        const vehicles = _.filter(this.vehicles, v => v.vehicleInfo.vClass === vehicleClass);
        const randomVehicle = _.sample<Vehicle>(vehicles);
        if (randomVehicle) {
            const { x, y, z } = randomVehicle.mesh.position;
            // the offsets put the camera slightly behind the vehicle and above the road
            this.camera.position.set(x, y + 2, z + 10);
        } else {
            console.warn('cannot find a random', vehicleClass);
        }
    }

    moveCameraToRandomLight() {
        const randomLight = this.trafficLights.getRandomLight();
        if (randomLight) {
            const { x, y, z } = randomLight.position;
            // the offset puts the camera slightly behind the light
            this.camera.position.set(x, y, z + 10);
        } else {
            console.warn('cannot find a random traffic light');
        }
    }

    moveCameraToLatitudeAndLongitude(lat: number, lng: number) {
        const simulationCoords = this.transform.latLngToXZ({ lat, lng });
        if (simulationCoords) {
            const [x, z] = simulationCoords;
            this.camera.position.set(x, this.camera.position.y, z);
            this.camera.lookAt(new three.Vector3(x, 0, z));
        }
    }

    checkParentsAndFaceForUserData(intersect: three.Intersection): any {
        // first check the face for userData. This comes from a merged geometry.
        const faceData = (intersect.face as any)?.userData;
        if (faceData) {
            return faceData;
        }
        // Check if the intersected object itself has faceToUserData mapping (from merged geometries)
        const faceIndex = intersect.faceIndex;
        if (faceIndex !== undefined && faceIndex !== null && intersect.object.userData?.faceToUserData) {
            const lookupData = intersect.object.userData.faceToUserData[faceIndex];
            if (lookupData) {
                return lookupData;
            }
        }
        // Otherwise look for userData on this object or its parents.
        return this.checkParentsForUserData(intersect.object);
    }

    checkParentsForUserData(obj: three.Object3D): any {
        if (!obj) {
            return null;
        } else if (obj.userData && Object.keys(obj.userData).length > 0) {
            // Return a merged object containing the name and rest of userData
            return { name: obj.name || obj.userData.name, ...obj.userData };
        } else {
            return obj.parent ? this.checkParentsForUserData(obj.parent) : null;
        }
    }

    highlightMesh(mesh: three.Mesh) {
        const newMesh = mesh.clone();
        newMesh.material = HIGHLIGHT;
        return newMesh;
    }

    highlightObject(obj: three.Object3D) {
        if (obj instanceof three.Mesh) {
            return this.highlightMesh(obj as three.Mesh);
        }
        const { highlightObject } = this;
        const highlightObjectFn = highlightObject.bind(this);
        const newObject = obj.clone();
        newObject.children = newObject.children.map(child => {
            if (child instanceof three.Mesh) {
                child = highlightObjectFn(child);
            }
            return child;
        });
        return newObject;
    }

    highlightByOsmId(osmId: string, changeCamera: boolean) {
        if (this.osmIdToMeshes[osmId]) {
            const selected: MeshAndPosition[] = this.osmIdToMeshes[osmId];
            const { scene, highlightMesh } = this;
            this.highlightedMeshes = this.highlightedMeshes.concat(
                selected.map(({ mesh }) => {
                    const originalMesh = mesh;
                    const highlightedMesh = highlightMesh(mesh);
                    originalMesh.visible = false;
                    scene.add(highlightedMesh);
                    return { highlightedMesh, originalMesh };
                }),
            );
            const positionUpdate = selected[0].position;
            if (changeCamera && positionUpdate !== null) {
                this.camera.position.copy(positionUpdate);
                this.camera.position.add(new three.Vector3(0, 50, 0));
                this.camera.lookAt(positionUpdate);
                this.camera.updateProjectionMatrix();
            }
        }
        return this.highlightedMeshes;
    }

    highlightByVehicleId(sumoId: string, changeCamera: boolean) {
        if (this.vehicles[sumoId]) {
            const originalMesh = this.vehicles[sumoId].mesh.clone();
            const update = this.highlightObject(this.vehicles[sumoId].mesh);
            this.highlightedVehicles.push({
                vehicle: this.vehicles[sumoId],
                id: sumoId,
                originalMaterial: ((this.vehicles[sumoId].mesh.children[0] as three.Mesh).material as three.Material).clone(),
            });
            (this.vehicles[sumoId].mesh.children[0] as three.Mesh).material = ((update
                .children[0] as three.Mesh).material as three.Material).clone();
            const { position } = originalMesh;
            if (changeCamera && position !== null) {
                this.camera.position.copy(position);
                this.camera.position.add(new three.Vector3(0, 50, 0));
                this.camera.lookAt(position);
                this.camera.updateProjectionMatrix();
            }
        }
        return this.highlightedVehicles.length > 0;
    }

    unhighlightRoute() {
        this.highlightedRoute.forEach(({ highlightedMesh, originalMesh }) => {
            this.scene.remove(highlightedMesh);
            originalMesh.visible = originalMesh.userData?.isHidden ? false : true;
        });
    }

    unselectMeshes() {
        const { removeVehicleObject, createVehicleObject } = this;
        const remove = removeVehicleObject.bind(this);
        const create = createVehicleObject.bind(this);
        this.highlightedVehicles.forEach(vehicle => {
            remove(vehicle.id);
            create(vehicle.id, vehicle.vehicle.vehicleInfo);
        });
        this.highlightedVehicles = [];
        this.highlightedMeshes.forEach(({ highlightedMesh, originalMesh }) => {
            this.scene.remove(highlightedMesh);
            originalMesh.visible = originalMesh.userData?.isHidden ? false : true;
        });
        this.highlightedMeshes = [];
        return;
    }

    onMouseDown(event: MouseEvent) {
        // Drags shouldn't lead to clicks.
        const { domElement } = this.renderer;
        this.cancelNextClick = false;
        this.mouseDownPos = { x: event.clientX, y: event.clientY };

        const onMouseMove = (e: MouseEvent) => {
            const dist = Math.sqrt(
                Math.pow(e.clientX - this.mouseDownPos.x, 2) +
                Math.pow(e.clientY - this.mouseDownPos.y, 2)
            );
            if (dist > this.mouseMoveThreshold) {
                this.cancelNextClick = true;
            }
        };
        const onMouseUp = () => {
            domElement.removeEventListener('mousemove', onMouseMove);
            domElement.removeEventListener('mouseup', onMouseUp);
        };
        domElement.addEventListener('mousemove', onMouseMove);
        domElement.addEventListener('mouseup', onMouseUp);
    }

    onClick(event: MouseEvent) {
        if (this.cancelNextClick) {
            // This was probably a drag, not a click.
            this.cancelNextClick = false;
            return;
        }

        const mouse = new three.Vector2();
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        // Normalize coordinates to [-1, +1] relative to the inner content (clientWidth)
        // This ensures pixel-perfect alignment with the renderer's drawing buffer
        mouse.x = ((event.clientX - rect.left) / this.parentElement.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / this.parentElement.clientHeight) * 2 + 1;

        const raycaster = new three.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        const intersections = raycaster.intersectObjects(this.scene.children, true);
        const firstHit = intersections.length > 0 ? intersections[0] : null;

        const objects = intersections
            .map(intersect => this.checkParentsAndFaceForUserData(intersect))
            .filter(userData => !!userData);

        if (firstHit) {
            const { x, z } = firstHit.point;
            const sumoPoint = this.transform.xzToSumoXy([x, z]);
            const latLng = this.transform.toLatLng([x, z]);
            this.params.onClick(latLng, sumoPoint, objects);
        } else {
            this.params.onClick(null, null, objects);
        }
    }

    getVehicleInfo(vehicleId: string): VehicleInfo {
        return this.vehicles[vehicleId].vehicleInfo;
    }

    onResize(w?: number, h?: number) {
        const isCurrentlyFullscreen = !!document.fullscreenElement;

        // ABSOLUTE FULLSCREEN:
        // In fullscreen de breedte/hoogte van het window prefereren boven de container
        // om zwarte randen ("black boxes") door padding/margins te voorkomen.
        const width = isCurrentlyFullscreen ? window.innerWidth : (w ?? this.parentElement.clientWidth);
        const height = isCurrentlyFullscreen ? window.innerHeight : (h ?? this.parentElement.clientHeight);

        // EXIT DETECTION:
        // Als we net uit fullscreen komen, wachten we heel even tot de zijbalk van de
        // dashboard layout is hersteld om "verspringen" te voorkomen.
        if (this.wasFullscreen && !isCurrentlyFullscreen) {
            if (this.exitStabilityTimer) clearTimeout(this.exitStabilityTimer);

            this.exitStabilityTimer = setTimeout(() => {
                this.pendingResize = {
                    width: w ?? this.parentElement.clientWidth,
                    height: h ?? this.parentElement.clientHeight
                };
                this.wasFullscreen = false;
                this.exitStabilityTimer = null;
            }, 80);
            return;
        }

        this.wasFullscreen = isCurrentlyFullscreen;

        // Record the size but do NOT apply it yet to prevent feedback loops/jitter
        this.pendingResize = { width, height };
    }

    private applyResize(width: number, height: number) {
        // CRITIEK: Voorkom NaN of Infinity aspect ratios
        if (width <= 0 || height <= 0) return;

        // Ensure no residual view offsets cause "right shifts" during the transition
        this.camera.clearViewOffset();

        // 1. Update Renderer (Drawing Buffer)
        // We laten Three.js nu weer de CSS style updaten (default true) om ervoor te
        // zorgen dat de canvas DOM element exact de monitor vult zonder zwarte vakken.
        this.renderer.setSize(width, height);

        // 2. Update Postprocessing
        const pixelRatio = this.renderer.getPixelRatio();
        this.postprocessing.onResize(width, height, pixelRatio);

        // 3. Update Camera Projection
        const newAspect = width / height;
        this.camera.fov = this.referenceFov;
        this.camera.aspect = newAspect;
        this.camera.updateProjectionMatrix();

        // 4. Atomic Controls Refresh
        if (this.controls) {
            this.controls.update();
        }

        // 5. Update reference for Dashboard
        if (!document.fullscreenElement) {
            this.referenceAspect = newAspect;
        }
    }

    dispose() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        if (this.gui) {
            this.gui.destroy();
        }

        if (this.stats && this.stats.dom) {
            this.parentElement.removeChild(this.stats.dom);
        }

        if (this.renderer && this.renderer.domElement) {
            this.parentElement.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }

        // Scene disposal
        this.scene.traverse((object: any) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach((material: any) => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }
}
