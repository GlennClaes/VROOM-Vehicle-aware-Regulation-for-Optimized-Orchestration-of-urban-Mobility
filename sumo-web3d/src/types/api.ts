// All API type definitions — migrated from frontend/src/api.ts

export interface VehicleInfo {
    x: number
    y: number
    z: number
    speed: number
    type: string
    angle: number
    width: number
    length: number
    signals: number // bitset of Signals
    vehicle: string | null // for a person, are they in a vehicle?
    vClass: string
}

export enum Signals {
    LEFT = 1 << 0,
    RIGHT = 1 << 1,
    BRAKE = 1 << 3,
}

export interface LightInfo {
    phase: number
    programID: string
    state?: string
}

export interface AiDecision {
    tls_id: string
    timestep: number
    time: number
    action: number
    ai_phase_index?: number | null
    previous_phase_index?: number | null
    target_phase_index?: number | null
    current_sumo_phase?: number | null
    target_sumo_phase?: number | null
    switched: boolean
    yellow_transition?: boolean
    status?: string
    queue_estimate?: number
    vehicle_estimate?: number
    waiting_time_estimate?: number
    model?: string | null
    strategy?: string
    fallback?: boolean
    error?: string
}

// ── Websocket messages ──────────────────────────────────────────────────────

export interface SnapshotMessage extends Snapshot {
    type: 'snapshot'
}

export interface SimulationStateMessage extends SimulationState {
    type: 'state'
}

export type WebsocketMessage = SnapshotMessage | SimulationStateMessage

export interface Delta<T> {
    creations: { [id: string]: T }
    updates: { [id: string]: T }
    removals: string[]
}

/** Return type for /snap endpoint */
export interface Snapshot {
    time: number
    vehicles: Delta<VehicleInfo>
    lights: Delta<LightInfo>
    vehicle_counts: { [vClass: string]: number }
    kpis?: {
        avg_speed: number
        avg_waiting_time: number
        vehicle_count: number
        throughput: number
    }
    simulate_secs: number
    snapshot_secs: number
    ai_decisions?: AiDecision[]
}

/** Response type for /state endpoint */
export interface SimulationState {
    scenario: string
    simulationStatus: SimulationStatus
    delayMs: number
}

export type SimulationStatus = 'off' | 'running' | 'paused'

/** Response type for /scenario endpoint */
export interface ScenarioName {
    displayName: string
    kebabCase: string
}

// ── Network types ───────────────────────────────────────────────────────────

export interface Network {
    net: Net
}

export interface Connection {
    dir: string
    from: string
    fromLane: string
    linkIndex: string
    state: string
    tl: string
    to: string
    toLane: string
    via: string
}

export interface Lane {
    id: string
    index: string
    length: string
    shape: string
    speed: string
    allow?: string
    width?: string
}

export type SpreadType = 'center' | 'right'

export interface Edge {
    function: string
    id: string
    lane: Lane | Lane[]
    from: string
    priority: string
    to: string
    type?: string
    spreadType?: SpreadType
}

export type JunctionType =
    | 'dead_end'
    | 'internal'
    | 'priority'
    | 'rail_crossing'
    | 'right_before_left'
    | 'traffic_light'

export interface Junction {
    id: string
    incLanes: string
    intLanes: string
    request: unknown
    shape: string
    type: JunctionType
    x: string
    y: string
    z: string
}

export interface Location {
    convBoundary: string
    netOffset: string
    origBoundary: string
    projParameter: string
}

export interface Phase {
    duration: string
    state: string
}

export interface TlLogic {
    id: string
    offset: string
    phase: Phase[]
    programID: string
    type: string
}

export interface Type {
    id: string
    priority: string
    numLanes: string
    speed: string
    allow?: string
    disallow?: string
    oneway: string
    width?: string
}

export interface Net {
    connection: Connection[]
    type: Type[]
    edge: Edge[]
    junction: Junction[]
    location: Location
    tlLogic: TlLogic | TlLogic[]
    version: string
    'xmlns:xsi': string
    'xsi:noNamespaceSchemaLocation': string
}

export interface AdditionalResponse {
    poly?: Polygon[]
    busStop?: BusStop[]
    tlLogic?: TlLogic | TlLogic[]
}

export interface Polygon {
    id: string
    type: string
    color: string
    fill: string
    layer: string
    shape: string
    param?: Param | Param[]
}

export interface Param {
    key: string
    value: string
}

export interface BusStop {
    id: string
    lane: string
    startPos: string
    endPos: string
    lines: string
}

export interface SumoSettings {
    viewsettings: {
        delay?: { value: string }
        scheme?: { name: string }
        viewport?: { x: string; y: string; zoom: string }
    }
}

export interface Object3DLoaderParam {
    objectUrl: string
    materialUrl?: string
    scale?: number
}

export interface SupportedVehicle {
    label: string
    models: Object3DLoaderParam[]
}
