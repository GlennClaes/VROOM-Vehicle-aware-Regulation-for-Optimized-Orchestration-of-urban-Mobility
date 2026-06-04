import { minBy } from 'lodash-es'

export interface PolyLineDistance {
    d2: number
    dLine: number
    dPerp: number
}

function add(a: number[], b: number[]): number[] {
    return [a[0] + b[0], a[1] + b[1]]
}

function sub(a: number[], b: number[]): number[] {
    return [a[0] - b[0], a[1] - b[1]]
}

function dot(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1]
}

export function vectorNorm(v: number[]): number {
    return Math.sqrt(dot(v, v))
}

function scale(v: number[], k: number): number[] {
    return [v[0] * k, v[1] * k]
}

function distance2(a: number[], b: number[]) {
    const dx = a[0] - b[0]
    const dy = a[1] - b[1]
    return dx * dx + dy * dy
}

function distance(a: number[], b: number[]) {
    return Math.sqrt(distance2(a, b))
}

export function closestPointOnLineSegment(
    a: number[],
    b: number[],
    pt: number[],
): PolyLineDistance {
    const bMinusA = sub(b, a)
    const bAnorm = vectorNorm(bMinusA)
    const ab = scale(bMinusA, 1 / bAnorm)
    const [dx, dy] = ab
    const ptA = sub(pt, a)

    const dLine = dx * ptA[0] + dy * ptA[1]
    const dPerp = dx * ptA[1] - dy * ptA[0]

    if (dLine < 0) {
        return { d2: distance2(a, pt), dLine, dPerp }
    } else if (dLine > bAnorm) {
        return { d2: distance2(pt, b), dLine, dPerp }
    } else {
        return { d2: dPerp * dPerp, dLine, dPerp }
    }
}

export function polylineDistance(
    vertices: number[][],
    pt: number[],
    isClosed = false,
): PolyLineDistance {
    let totalD = 0
    let closestD: PolyLineDistance | null = null

    const lastIndex = isClosed ? vertices.length : vertices.length - 1
    for (let i = 0; i < lastIndex; i++) {
        const a = vertices[i]
        const b = vertices[(i + 1) % vertices.length]
        const thisD = closestPointOnLineSegment(a, b, pt)
        if (!closestD || thisD.d2 < closestD.d2) {
            closestD = { ...thisD }
            closestD.dLine += totalD
        }
        totalD += distance(a, b)
    }

    if (!closestD) throw new Error('polylines must have 2+ vertices')
    return closestD
}

export function pointAlongPolyline(vertices: number[][], d: number, isClosed = false): number[] {
    let totalD = 0

    const lastIndex = isClosed ? vertices.length : vertices.length - 1
    for (let i = 0; i < lastIndex; i++) {
        const a = vertices[i]
        const b = vertices[(i + 1) % vertices.length]
        const len = distance(a, b)
        if (totalD + len >= d) {
            const frac = (d - totalD) / len
            return [a[0] * (1 - frac) + b[0] * frac, a[1] * (1 - frac) + b[1] * frac]
        }
        totalD += len
    }
    throw new Error('distance is too great for polyline')
}

export function offsetLineSegment(vertices: number[][], amount: number): number[][] {
    if (vertices.length !== 2) {
        throw new Error('offsetLineSegment is only implemented for simple line segments.')
    }
    const [a, b] = vertices
    const v = sub(b, a)
    const vNorm = scale(v, 1 / vectorNorm(v))
    const vOffset = scale([vNorm[1], -vNorm[0]], amount)
    return [add(a, vOffset), add(b, vOffset)]
}

export function findClosestPoint(point: number[], points: number[][]) {
    return minBy(points, (element) => distance(element, point))
}
