import * as THREE from 'three'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { mapValues, map } from 'lodash-es'

import type {
    AdditionalResponse,
    Network,
    ScenarioName,
    SimulationState,
    SumoSettings,
} from './types/api'
import { loadOBJFile } from './three/three-utils'
import { promiseObject, type FeatureCollection } from '@/utils'
import { SUPPORTED_VEHICLE_CLASSES } from './constants'

export interface InitResources {
    availableScenarios: ScenarioName[]
    settings: SumoSettings | null
    network: Network
    vehicles: { [vehicleClass: string]: THREE.Object3D[] }
    additional: AdditionalResponse | null
    arrows: {
        left: THREE.Object3D
        right: THREE.Object3D
        uturn: THREE.Object3D
        straight: THREE.Object3D
    }
    water: FeatureCollection | null
    simulationState: SimulationState
    webSocket: WebSocket
    isProjection: boolean
}

// Use relative path for the API endpoint to stay within the same origin/proxy
export const SUMO_ENDPOINT = '/map'

// In production (port 80 or 443), we route through the gateway.
// In development (port 3000), we connect directly to the exposed port 5678.
const { hostname, protocol, port } = window.location
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
const isDev = port === '3000' || port === '5173'
const WEB_SOCKETS_ENDPOINT = isDev
    ? `${wsProtocol}//${hostname}:5678/`
    : `${wsProtocol}//${hostname}${port && port !== '80' && port !== '443' ? ':' + port : ''}/ws-simulator/`

const textureLoader = new THREE.TextureLoader()
const mtlLoader = new MTLLoader()

function loadMaterial(url: string): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ map: textureLoader.load(url) })
}

async function loadObjMtl(objFile: string, mtlFile: string): Promise<THREE.Object3D> {
    return new Promise<THREE.Object3D>((resolve, reject) => {
        mtlLoader.load(
            mtlFile,
            (mats) => {
                mats.preload()
                const objLoader = new OBJLoader()
                objLoader.setMaterials(mats)
                objLoader.load(objFile, resolve, undefined, reject)
            },
            undefined,
            reject,
        )
    })
}

function loadVehicles(): { [vehicleClass: string]: Promise<THREE.Object3D[]> } {
    return mapValues(SUPPORTED_VEHICLE_CLASSES, (v, key) => {
        // PRELOAD optimization: Only load the first model of each class during init.
        // The rest will be loaded on-demand or backgrounded.
        const modelsToPreload = v.models.slice(0, 1)
        
        return Promise.all(
            map(modelsToPreload, async (model) => {
                const { materialUrl, scale } = model
                let obj: THREE.Object3D
                if (materialUrl) {
                    if (materialUrl.endsWith('.mtl')) {
                        obj = await loadObjMtl(model.objectUrl, materialUrl)
                    } else {
                        obj = await loadOBJFile(model.objectUrl, loadMaterial(materialUrl))
                    }
                } else {
                    obj = await loadOBJFile(model.objectUrl)
                }
                if (scale) obj.scale.setScalar(scale)
                return obj
            }),
        )
    })
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (response.status !== 200) throw new Error(`Unable to load ${url}: ${response.status}`)
    console.log(`Loaded ${url}`)
    return response.json() as Promise<T>
}

async function fetchJsonAllowFail<T>(url: string): Promise<T | null> {
    const response = await fetch(url)
    if (response.status === 404) {
        console.log(`${url} 404'd.`)
        return null
    }
    console.log(`Loaded ${url}`)
    return response.json() as Promise<T>
}

export async function init(): Promise<InitResources> {
    const loadStartMs = window.performance.now()

    const simulationState = await fetchJson<SimulationState>(`${SUMO_ENDPOINT}/state`)
    const network = await fetchJson<Network>(`${SUMO_ENDPOINT}/network`)
    const isProjection =
        network.net.location.projParameter.length > 0 &&
        network.net.location.projParameter !== '!'

    const webSocket = new WebSocket(WEB_SOCKETS_ENDPOINT)
    const webSocketPromise = new Promise<WebSocket>((resolve, reject) => {
        webSocket.onopen = () => resolve(webSocket)
        webSocket.onerror = reject
    })

    try {
        const resources = await promiseObject({
            // Fix 1: Zorg dat 'additional' alle properties heeft die een shader zou kunnen loopen
            additional: fetchJsonAllowFail<AdditionalResponse>(`${SUMO_ENDPOINT}/additional`)
                .then(res => res ?? {
                    tlLogic: [],
                    busStop: [],
                    chargingStation: [],
                    parkingArea: [],
                    poly: []
                } as AdditionalResponse),

            availableScenarios: fetchJson<ScenarioName[]>(`${SUMO_ENDPOINT}/scenarios`),

            vehicles: promiseObject(loadVehicles()) as Promise<{ [k: string]: THREE.Object3D[] }>,

            // Fix 2: De renderer crasht op lege water-features.
            // We geven 1 dummy feature met een geldige (maar onzichtbare) coordinaat.
            water: fetchJsonAllowFail<FeatureCollection>(`${SUMO_ENDPOINT}/water`)
                .then(res => res ?? {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 0], [0, 0]]] },
                        properties: {}
                    }]
                } as FeatureCollection),

            // Fix 3: De renderer crasht op 'reading 0' van settings.
            // Dit komt omdat viewsettings een ARRAY moet zijn met minstens 1 object.
            settings: fetchJsonAllowFail<SumoSettings>(`${SUMO_ENDPOINT}/settings`)
                .then(res => {
                    if (res && res.viewsettings) return res;
                    return {
                        viewsettings: [{
                            viewport: { x: 0, y: 0, zoom: 1 },
                            scheme: { name: 'default' }
                        }]
                    } as unknown as SumoSettings;
                }),

            arrows: promiseObject({
                left: loadOBJFile(`${SUMO_ENDPOINT}/arrows/LeftArrow.obj`),
                right: loadOBJFile(`${SUMO_ENDPOINT}/arrows/RightArrow.obj`),
                uturn: loadOBJFile(`${SUMO_ENDPOINT}/arrows/UTurnArrow.obj`),
                straight: loadOBJFile(`${SUMO_ENDPOINT}/arrows/StraightArrow.obj`),
            }) as Promise<{ left: THREE.Object3D; right: THREE.Object3D; uturn: THREE.Object3D; straight: THREE.Object3D }>,

            webSocket: webSocketPromise,
        })

        const loadEndMs = window.performance.now()
        console.log(`Loaded static resources in ${loadEndMs - loadStartMs} ms.`)

        return {
            ...resources,
            simulationState,
            network,
            isProjection,
        }
    } catch (e) {
        webSocket.close()
        throw e
    }
}
