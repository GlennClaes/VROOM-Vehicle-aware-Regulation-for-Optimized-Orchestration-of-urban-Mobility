import * as THREE from 'three'
import { filter, forEach, groupBy, keyBy, sample } from 'lodash-es'

import type { Network, TlLogic } from '../types/api'
import type { Transform } from '../utils/coords'
import type { InitResources } from '../initialization'
import { TRAFFIC_LIGHTS, TL_HOUSING } from './materials'
import { parseShape } from '../utils/sumo-utils'
import { forceArray } from '@/utils'

enum Directions {
    LEFT = 'l',
    RIGHT = 'r',
    STRAIGHT = 's',
    UTURN = 't',
    PARTIAL_LEFT = 'L',
    PARTIAL_RIGHT = 'R',
}

export default class TrafficLights {
    private lightObjects: { [lightId: string]: THREE.Object3D[] } = {}
    private lightCycles: { [programId: string]: { [lightId: string]: TlLogic } } = {}
    private currentPrograms: { [lightId: string]: string } = {}
    private arrows: InitResources['arrows']

    constructor(init: InitResources) {
        this.arrows = init.arrows
    }

    loadNetwork(network: Network, t: Transform): THREE.Group {
        const { net } = network
        const group = new THREE.Group()

        const connections = forceArray(net.connection || [])
        const tlConnections = filter(connections, (c) => c && !!c.tl)
        const edgeIdToEdge = keyBy(forceArray(net.edge || []), 'id')

        const SEP = '::::::'
        const connectionsByApproach = groupBy(tlConnections, (c) => `${c.tl}${SEP}${c.from}`)

        forEach(connectionsByApproach, (connections, approachKey) => {
            const [lightId, fromEdgeId] = approachKey.split(SEP)
            const edge = edgeIdToEdge[fromEdgeId]
            if (!edge) return

            const lanes = forceArray(edge.lane || [])
            if (lanes.length === 0) return

            const headsInApproach = groupBy(connections, (c) => `${c.fromLane}_${c.linkIndex}`)

            const rightMostLane = lanes[0]
            const shape = parseShape(rightMostLane.shape)
            const [x, y = 0, z] = t.sumoXyzToXyz(shape[shape.length - 1])
            const [px, , pz] = t.sumoXyzToXyz(shape[shape.length - 2])
            const yRotation = Math.atan2(px - x, pz - z)

            const dx = x - px;
            const dz = z - pz;
            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            const nx = -dz / len;
            const nz = dx / len;

            const poleOffset = 3.5;
            const polePos = new THREE.Vector3(x + nx * poleOffset, y, z + nz * poleOffset)

            const gantryGroup = new THREE.Group()
            gantryGroup.position.copy(polePos)
            gantryGroup.rotation.y = yRotation
            group.add(gantryGroup)

            const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 10)
            const pole = new THREE.Mesh(poleGeo, TL_HOUSING)
            pole.position.y = 5
            gantryGroup.add(pole)

            const armLength = poleOffset + (lanes.length * 3.2) + 0.5
            const armGeo = new THREE.CylinderGeometry(0.15, 0.15, armLength)
            const arm = new THREE.Mesh(armGeo, TL_HOUSING)
            arm.rotation.z = Math.PI / 2
            arm.position.set(-armLength / 2, 9, 0)
            gantryGroup.add(arm)

            forEach(headsInApproach, (connsInHead) => {
                const first = connsInHead[0]
                const laneIdx = Number(first.fromLane)
                const linkIndex = Number(first.linkIndex)
                const { dir } = first

                const headDistance = poleOffset + (laneIdx * 3.2)

                const head = this.buildSignalHead(dir)
                head.name = `Light ${lightId} Lane ${first.fromLane} ${dir}`
                head.userData = { type: 'light' }
                head.position.set(-headDistance, 9, 0)
                gantryGroup.add(head)

                if (!this.lightObjects[lightId]) this.lightObjects[lightId] = []
                this.lightObjects[lightId][linkIndex] = head
            })
        })

        return group
    }

    addLogic(tlLogics: TlLogic[]) {
        forEach(groupBy(tlLogics, 'programID'), (programLogics, programId) => {
            this.lightCycles[programId] = keyBy(programLogics, 'id')
        })
    }

    getRandomLight(): THREE.Object3D | null {
        const randomConnection = sample(Object.values(this.lightObjects))
        return randomConnection ? randomConnection[0] : null
    }

    setLightProgram(lightId: string, programId: string) {
        this.currentPrograms[lightId] = programId
    }

    initializeDefaultPhases() {
        Object.keys(this.lightObjects).forEach(lightId => {
            const programId = Object.keys(this.lightCycles).find(pId => this.lightCycles[pId]?.[lightId])
            if (programId) {
                this.setLightProgram(lightId, programId)
                
                // Find the first green phase to match backend initialization
                const lightCycle = this.lightCycles[programId][lightId]
                let firstGreenPhase = 0
                if (lightCycle && lightCycle.phase) {
                    const phases = Array.isArray(lightCycle.phase) ? lightCycle.phase : [lightCycle.phase]
                    const idx = phases.findIndex(p => {
                        const state = (p.state || '').toLowerCase()
                        return state.includes('g') && !state.includes('y')
                    })
                    if (idx !== -1) {
                        firstGreenPhase = idx
                    }
                }
                
                this.setPhase(lightId, firstGreenPhase)
            }
        })
    }

    setPhase(lightId: string, phaseIndex?: number, externalState?: string) {
        let lightState: string | undefined = externalState

        if (!lightState && phaseIndex !== undefined) {
            const programId = this.currentPrograms[lightId]
            if (!programId) return
            const lightCycle = this.lightCycles[programId]?.[lightId]
            if (lightCycle && lightCycle.phase[phaseIndex]) {
                lightState = lightCycle.phase[phaseIndex].state
            }
        }

        if (!lightState) return

        const lights = this.lightObjects[lightId]
        lights?.forEach((light, i) => {
            const state = lightState?.charAt(i).toLowerCase()
            const rBulb = light.getObjectByName('bulb_r') as THREE.Mesh
            const yBulb = light.getObjectByName('bulb_y') as THREE.Mesh
            const gBulb = light.getObjectByName('bulb_g') as THREE.Mesh

            if (rBulb && yBulb && gBulb) {
                rBulb.material = TRAFFIC_LIGHTS['x']
                yBulb.material = TRAFFIC_LIGHTS['x']
                gBulb.material = TRAFFIC_LIGHTS['x']

                if (state === 'r' || state === 'u') rBulb.material = TRAFFIC_LIGHTS['r']
                if (state === 'y') yBulb.material = TRAFFIC_LIGHTS['y']
                if (state === 'g' || state === 'o') gBulb.material = TRAFFIC_LIGHTS['g']
            }
        })
    }

    private buildSignalHead(dir: string): THREE.Group {
        const headGroup = new THREE.Group()
        const headGeo = new THREE.BoxGeometry(1.2, 3.2, 0.8)
        const head = new THREE.Mesh(headGeo, TL_HOUSING)
        head.position.y = -1.6
        headGroup.add(head)

        const bulbGeo = new THREE.SphereGeometry(0.45, 16, 16)
        const visorGeo = new THREE.BoxGeometry(1, 0.2, 0.5)

        const bulbs = [
            { name: 'bulb_r', pos: -0.6, color: 'x' },
            { name: 'bulb_y', pos: -1.6, color: 'x' },
            { name: 'bulb_g', pos: -2.6, color: 'x' }
        ]

        bulbs.forEach(b => {
            const mesh = new THREE.Mesh(bulbGeo, TRAFFIC_LIGHTS[b.color])
            mesh.name = b.name
            mesh.position.set(0, b.pos, 0.4)
            headGroup.add(mesh)

            const visor = new THREE.Mesh(visorGeo, TL_HOUSING)
            visor.position.set(0, b.pos + 0.5, 0.6)
            visor.rotation.x = -0.3
            headGroup.add(visor)
        })

        const arrow = this.getObjectForDirection(dir).clone()
        arrow.scale.setScalar(0.4)
        arrow.position.set(0, -1.6, 0.46)
        headGroup.add(arrow)

        return headGroup
    }

    private getObjectForDirection(dir: string): THREE.Object3D {
        if (dir === Directions.LEFT || dir === Directions.PARTIAL_LEFT) return this.arrows.left
        if (dir === Directions.RIGHT || dir === Directions.PARTIAL_RIGHT) return this.arrows.right
        if (dir === Directions.STRAIGHT) return this.arrows.straight
        if (dir === Directions.UTURN) return this.arrows.uturn
        throw new Error(`Unknown turn direction: ${dir}.`)
    }
}

