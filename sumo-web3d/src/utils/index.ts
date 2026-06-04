/**
 * Await an object of promises, returning an object with the same keys but resolved values.
 */
export async function promiseObject<T extends Record<string, unknown>>(obj: {
    [K in keyof T]: Promise<T[K]>
}): Promise<T> {
    const keys = Object.keys(obj) as (keyof T)[]
    const values = await Promise.all(keys.map((k) => obj[k]))
    const out = {} as T
    keys.forEach((k, i) => {
        out[k] = values[i] as T[typeof k]
    })
    return out
}

export function makeLookup(array: string[]): { [id: string]: boolean } {
    const o: { [k: string]: boolean } = {}
    array.forEach((key) => {
        o[key] = true
    })
    return o
}

export function forceArray<T>(t: T | T[]): T[] {
    return Array.isArray(t) ? t : [t]
}

export type Feature = GeoJSON.Feature<GeoJSON.GeometryObject>
export type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.GeometryObject>
