import { reactive, readonly, watch, toRaw, type DeepReadonly } from 'vue'
import { forEach } from 'lodash-es'

import type { Delta, ScenarioName, SimulationStatus, VehicleInfo, WebsocketMessage } from '../types/api'
import { SUPPORTED_VEHICLE_CLASSES } from '../constants'
import type { LatLng } from '../utils/coords'
import type { InitResources } from '../initialization'
import Sumo3D, { type NameAndUserData, type SumoState, SUMO_ENDPOINT } from '../sumo3d'
import { includes, find, last } from 'lodash-es'

export interface AppState {
    availableScenarios: ScenarioName[]
    clickedPoint: LatLng | null
    clickedSumoPoint: number[] | null
    clickedObjects: NameAndUserData[] | null
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
    isDashboardVisible: boolean
    stats: SumoState
}

export type StoreActions = ReturnType<typeof createStore>['actions']
export type StoreState = DeepReadonly<AppState>

export function createStore(init: InitResources) {
    const state = reactive<AppState>({
        availableScenarios: init.availableScenarios,
        clickedPoint: null,
        clickedSumoPoint: null,
        clickedObjects: null,
        clickedVehicleId: null,
        clickedVehicleInfo: null,
        followingVehicle: false,
        edgesHighlighted: false,
        stats: { time: 0, payloadSize: 0, vehicleCounts: {}, simulateSecs: 0, snapshotSecs: 0, kpis: {} },
        isLoading: false,
        isProjection: init.isProjection,
        searchBoxErrorMessage: '',
        isDashboardVisible: false,
        ...init.simulationState,
    })

    const { webSocket } = init
    let sumo3d: Sumo3D | null = null
    let _lastSyncTime = 0

    function setSumo3D(instance: Sumo3D) {
        sumo3d = instance
        // Sync the rendering state immediately upon initialization
        if (sumo3d) {
            sumo3d.setRenderingEnabled(!state.isDashboardVisible);
        }
    }

    webSocket.onmessage = (event) => {
        const msg: WebsocketMessage = JSON.parse(event.data as string)
        if (msg.type === 'snapshot') {
            // Only update statistics if they are provided in this message (throttled updates)
            const newStats = { ...state.stats };
            newStats.time = msg.time;
            newStats.payloadSize = event.data.length;

            if (msg.vehicleCounts !== undefined) newStats.vehicleCounts = msg.vehicleCounts;
            else if (msg.vehicle_counts !== undefined) newStats.vehicleCounts = msg.vehicle_counts;

            if (msg.kpis !== undefined) {
                newStats.kpis = msg.kpis;
                newStats.vehicle_count = msg.kpis.vehicle_count;
            }

            if (msg.simulate_secs !== undefined) newStats.simulateSecs = msg.simulate_secs;
            if (msg.snapshot_secs !== undefined) newStats.snapshotSecs = msg.snapshot_secs;
            if (msg.ai_decisions !== undefined) newStats.aiDecisions = msg.ai_decisions;
            else newStats.aiDecisions = [];

            state.stats = newStats;
            if (sumo3d) {
                processDelta(msg.vehicles, {
                    enter: (id, info) => sumo3d!.createVehicleObject(id, info),
                    update: (id, info) => sumo3d!.updateVehicleObject(id, info),
                    exit: (id) => sumo3d!.removeVehicleObject(id),
                })
                processDelta(msg.lights, {
                    enter: (id, info) => sumo3d!.updateLightObject(id, info),
                    update: (id, info) => sumo3d!.updateLightObject(id, info),
                    exit: (id) => console.warn('Disappearing traffic light!', id),
                })
                if (state.clickedVehicleId) {
                    state.clickedVehicleInfo = sumo3d!.getVehicleInfo(state.clickedVehicleId)
                }
                sumo3d!.updateStats(state.stats)
            }
        } else if (msg.type === 'state') {
            state.simulationStatus = msg.simulationStatus
            state.delayMs = msg.delayMs
        } else if (msg.type === 'finished') {
            // Forward finished event to parent
            if (window.parent) {
                window.parent.postMessage({
                    type: 'sumo-finished',
                    data: msg
                }, '*');
            }
        } else {
            console.error('unrecognized message:', msg)
        }
    }

    function processDelta<T>(
        delta: Delta<T>,
        callbacks: { enter(id: string, t: T): void; update(id: string, t: T): void; exit(id: string): void },
    ) {
        forEach(delta.creations, (v, k) => callbacks.enter(k, v))
        forEach(delta.updates, (v, k) => callbacks.update(k, v))
        forEach(delta.removals, (v) => callbacks.exit(v))
    }

    // ── Actions ────────────────────────────────────────────────────────────────

    function startSimulation() {
        console.log('[SUMO-WEB3D] Attempting to send start action via WebSocket')
        if (webSocket.readyState === WebSocket.OPEN) {
            webSocket.send(JSON.stringify({ type: 'action', action: 'start' }))
        } else {
            console.error('[SUMO-WEB3D] Cannot start simulation: WebSocket state is', webSocket.readyState)
        }
    }
    function pauseSimulation() {
        webSocket.send(JSON.stringify({ type: 'action', action: 'pause' }))
    }
    function resumeSimulation() {
        webSocket.send(JSON.stringify({ type: 'action', action: 'resume' }))
    }
    function cancelSimulation() {
        Object.assign(state, {
            clickedPoint: null, clickedSumoPoint: null, clickedObjects: [],
            clickedVehicleId: null, clickedVehicleInfo: null,
            stats: { time: 0, payloadSize: 0, vehicleCounts: {}, simulateSecs: 0, snapshotSecs: 0, kpis: {} },
        })
        if (sumo3d) {
            sumo3d.unselectMeshes()
            sumo3d.purgeVehicles()
        }
        webSocket.send(JSON.stringify({ type: 'action', action: 'cancel' }))
    }
    function setMapVisible(visible: boolean) {
        state.isDashboardVisible = !visible;
        if (sumo3d) {
            sumo3d.setRenderingEnabled(visible);
        }
        // If switching to dashboard, trigger an immediate sync
        if (!visible) _lastSyncTime = 0;
    }

    function changeDelay(delayMs: number) {
        webSocket.send(JSON.stringify({ type: 'action', action: 'changeDelay', delayLengthMs: delayMs }))
    }

    function changeScenario(scenario: string) {
        window.location.pathname = `/scenarios/${scenario}/`
    }

    function clickPoint(
        point: LatLng | null,
        sumoPoint: number[] | null,
        objects: NameAndUserData[],
    ) {
        state.clickedPoint = point
        state.clickedSumoPoint = sumoPoint
        state.clickedObjects = objects
        state.clickedVehicleId = null
        state.clickedVehicleInfo = null

        if (sumo3d) {
            if (state.edgesHighlighted) {
                state.edgesHighlighted = false
                sumo3d.unhighlightRoute()
            }
            sumo3d.unselectMeshes()

            const validVehicleClasses = Object.keys(SUPPORTED_VEHICLE_CLASSES)
            const clickedVehicle = find(objects, (o) => includes(validVehicleClasses, o.vClass))
            state.clickedVehicleId = clickedVehicle?.name ?? null
            state.clickedVehicleInfo = clickedVehicle ? sumo3d.getVehicleInfo(clickedVehicle.name) : null

            if (objects.length > 0) {
                objects.forEach(({ name }) => {
                    sumo3d!.highlightByVehicleId(name, false)
                    const osmId = last(name.split(' '))
                    if (osmId) sumo3d!.highlightByOsmId(osmId, false)
                })
            }
        }
    }

    function followObjectPOV(vehicleId: string) {
        if (sumo3d) {
            sumo3d.onSelectFollowPOV(vehicleId)
            state.followingVehicle = true
        }
    }
    function unfollowObjectPOV() {
        if (sumo3d) {
            sumo3d.unfollowPOV()
            state.followingVehicle = false
        }
    }
    function removeVehicleCallback(id: string) {
        if (id === state.clickedVehicleId) {
            state.clickedVehicleId = null
            state.clickedVehicleInfo = null
        }
    }

    async function toggleRouteObjectHighlighted(vehicleId: string) {
        if (state.edgesHighlighted) {
            state.edgesHighlighted = false
            if (sumo3d) sumo3d.unhighlightRoute()
            return
        }
        const url = `${SUMO_ENDPOINT}/vehicle_route?${vehicleId}`
        const response = await fetch(url)
        if (response.status !== 200) throw new Error(`Unable to load ${url}`)
        const edgeIds: string[] = await response.json()
        state.edgesHighlighted = edgeIds.length > 0
        if (sumo3d) sumo3d.onShowRouteObject(edgeIds)
    }

    function focusOnVehicleOfClass(vehicleClass: string) {
        if (sumo3d) sumo3d.moveCameraToRandomVehicleOfClass(vehicleClass)
    }
    function focusOnTrafficLight() {
        if (sumo3d) sumo3d.moveCameraToRandomLight()
    }

    const sumoXYRegex = /^(\d+),\s*(\d+)$/
    const latLngRegex = /^(-?\d+\.\d+?),\s*(-?\d+\.\d+?)$/

    const [west, south, east, north] = init.network.net.location.origBoundary.split(',').map(Number)
    const [left, bottom, right, top] = init.network.net.location.convBoundary.split(',').map(Number)

    function handleSearch(input: string) {
        if (sumo3d) {
            sumo3d.unselectMeshes()
            sumo3d.unhighlightRoute()
        }
        state.searchBoxErrorMessage = ''

        if (sumoXYRegex.test(input)) {
            const [, x, y] = input.match(sumoXYRegex)!.map(Number)
            if (x < left || x > right || y < bottom || y > top) {
                state.searchBoxErrorMessage = `Invalid x,y: ${left}<x<${right}, ${bottom}<y<${top}.`
            } else {
                if (sumo3d) sumo3d.moveCameraTo(x, y, 30)
            }
        } else if (state.isProjection && latLngRegex.test(input)) {
            const [, lat, lng] = input.match(latLngRegex)!.map(parseFloat)
            if (lat < south || lat > north || lng < west || lng > east) {
                state.searchBoxErrorMessage = `Invalid lat/lng: ${south}<lat<${north}, ${west}<lng<${east}.`
            } else {
                if (sumo3d) sumo3d.moveCameraToLatitudeAndLongitude(lat, lng)
            }
        } else {
            if (sumo3d) {
                let found = sumo3d.highlightByVehicleId(input, true)
                found = sumo3d.highlightByOsmId(input, true).length > 0 || found
                if (!found) state.searchBoxErrorMessage = 'Search input not found.'
            }
        }
    }

    function deselectSearch() {
        if (sumo3d) sumo3d.unselectMeshes()
    }

    function disconnect() {
        console.log('[SUMO-WEB3D] Disconnecting WebSocket as requested by parent')
        if (webSocket) {
            webSocket.onmessage = null
            webSocket.onerror = null
            webSocket.onclose = null
            if (webSocket.readyState === WebSocket.OPEN || webSocket.readyState === WebSocket.CONNECTING) {
                webSocket.close()
            }
        }
    }

    const actions = {
        setSumo3D,
        startSimulation,
        pauseSimulation,
        resumeSimulation,
        cancelSimulation,
        changeDelay,
        changeScenario,
        disconnect,
        clickPoint,
        followObjectPOV,
        unfollowObjectPOV,
        toggleRouteObjectHighlighted,
        focusOnVehicleOfClass,
        focusOnTrafficLight,
        handleSearch,
        deselectSearch,
        setMapVisible,
        onClick: clickPoint,
        onUnfollow: unfollowObjectPOV,
        onRemove: removeVehicleCallback,
        onUnhighlight: () => { },
        forceResize: () => {
            if (sumo3d) sumo3d.onResize()
        },
    };

    // --- postMessage Bridge ---
    if (new URLSearchParams(window.location.search).has('iframe')) {
        // Helper to send state to parent
        // High-Performance Sync: Send lean state to parent at 5 FPS (200ms)
        // Using toRaw() avoids the expensive serialization "hitch" every second.
        let _lastStatus = state.simulationStatus;
        watch(
            () => [state.stats.time, state.simulationStatus, state.clickedPoint],
            () => {
                const now = performance.now();
                const statusChanged = state.simulationStatus !== _lastStatus;
                _lastStatus = state.simulationStatus;

                // SMART THROTTLING & INTERACTION PRIORITY:
                // 1. If the status changed (e.g. started/stopped), sync IMMEDIATELY.
                // 2. If the user clicked something, sync IMMEDIATELY.
                // 3. Otherwise, throttle to save CPU/Network.
                const clickedJustNow = state.clickedPoint !== null; // Simple check for any click
                const throttleMs = state.isDashboardVisible ? 1000 : 200; // Faster when map is visible!
                
                if (!statusChanged && !clickedJustNow && now - _lastSyncTime < throttleMs) return;
                _lastSyncTime = now;

                if (!window.parent) return;

                // Extract raw values to avoid Proxy overhead in the dashboard
                const s = state as AppState;
                const stats = toRaw(s.stats);

                const leanState = {
                    stats: {
                        time: stats.time,
                        vehicleCounts: toRaw(stats.vehicleCounts),
                        kpis: toRaw(stats.kpis),
                        vehicle_count: stats.vehicle_count,
                        aiDecisions: toRaw(stats.aiDecisions || [])
                    },
                    simulationStatus: s.simulationStatus,
                    scenario: s.scenario,
                    delayMs: s.delayMs,
                    clickedPoint: s.clickedPoint ? { ...toRaw(s.clickedPoint) } : null,
                    isProjection: s.isProjection
                };

                window.parent.postMessage({
                    type: 'sumo-state',
                    state: leanState
                }, '*');
            },
            { immediate: true }
        );

        window.addEventListener('message', (event) => {
            const data = event.data;
            if (data && data.type === 'sumo-action') {
                const actionName = data.action as keyof typeof actions;
                if (actions[actionName]) {
                    // @ts-ignore
                    actions[actionName](...(data.payload || []));
                }
            }
        });
    }

    // AUTO-START logic: Triggered after everything is initialized
    if (init.simulationState?.simulationStatus === 'running') {
        console.log('[SUMO-WEB3D] Initial status is "running", attempting auto-start...')
        const tryAutoStart = (retries = 0) => {
            if (webSocket.readyState === WebSocket.OPEN) {
                console.log('[SUMO-WEB3D] WebSocket is open, triggering start...')
                startSimulation()
            } else if (retries < 15) {
                setTimeout(() => tryAutoStart(retries + 1), 500)
            } else {
                console.error('[SUMO-WEB3D] Auto-start failed after 15 attempts')
            }
        }
        tryAutoStart()
    }

    return {
        state: readonly(state),
        actions,
    }
}
