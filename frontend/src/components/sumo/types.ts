import type { ScenarioName, SimulationStatus, VehicleInfo } from './types/api'

export interface AppState {
    availableScenarios: ScenarioName[]
    clickedPoint: any
    clickedSumoPoint: number[] | null
    clickedObjects: any[] | null
    clickedVehicleId: string | null
    clickedVehicleInfo: VehicleInfo | null
    followingVehicle: boolean
    edgesHighlighted: boolean
    delayMs: number
    simulationStatus: SimulationStatus
    isLoading: boolean
    isProjection: boolean
    scenario: string
    searchBoxErrorMessage: string
    stats: any
}

export type StoreState = AppState
export type StoreActions = any
