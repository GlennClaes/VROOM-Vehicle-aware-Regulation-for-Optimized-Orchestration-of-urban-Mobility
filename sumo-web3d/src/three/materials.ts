import * as THREE from 'three'

const textureLoader = new THREE.TextureLoader()



export const OUTLINE = new THREE.LineBasicMaterial({ color: 0xffaa00 })
export const DEFAULT_ROAD_COLOR = 0x888888
export const DEFAULT_LANE_OPACITY = 1
export const SIDEWALK_COLOR = 0xaaaaaa
export const RAILWAY_COLOR = 0xffaa00

export const LANE_MARKING = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
});

export const LAND = new THREE.MeshStandardMaterial({
    color: 0x4a6b3a,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 1,
})

export const WATER = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    color: 0x3b6a7a,
    roughness: 0.3,
    metalness: 0.2,
    transparent: true,
    opacity: 0.9,
})

export const BUILDING_TOP = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
})

export const BUILDING_SIDE = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
})

export const ROAD = new THREE.MeshStandardMaterial({
    color: DEFAULT_ROAD_COLOR,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
})
export const ROAD_DECAL = new THREE.MeshBasicMaterial({ color: 'white', side: THREE.DoubleSide })

const zebraTexture = textureLoader.load(`zebra.jpg`)
zebraTexture.wrapS = THREE.RepeatWrapping
zebraTexture.wrapT = THREE.RepeatWrapping
zebraTexture.repeat.set(1, 1) // Adjust if need be

export const BUS_STOP = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    color: 0xaa2222,
    roughness: 0.9,
    metalness: 0.0,
})

export const CYCLEWAY = new THREE.MeshStandardMaterial({
    color: 0x773333,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
})

export const CROSSING = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: zebraTexture,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -10, // Ensure it pulls forward over the roads/junctions
    polygonOffsetUnits: -10,
})

export const RAILWAY = new THREE.MeshStandardMaterial({
    color: RAILWAY_COLOR,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
})

export const WALKWAY = new THREE.MeshStandardMaterial({
    color: SIDEWALK_COLOR,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
})

export const HIGHLIGHT = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide,
})

export const JUNCTION = new THREE.MeshStandardMaterial({
    color: 0x999999, // Lighter than roads to pop
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1, // pushes it backward slightly into the z depth buffer
    polygonOffsetUnits: 1,
})

export const TL_HOUSING = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.7,
    metalness: 0.2,
    side: THREE.DoubleSide,
})

export const TRAFFIC_LIGHTS: { [color: string]: THREE.MeshLambertMaterial } = {
    g: new THREE.MeshLambertMaterial({ color: 0x00ff00, side: THREE.DoubleSide }),
    y: new THREE.MeshLambertMaterial({ color: 0xffff00, side: THREE.DoubleSide }),
    r: new THREE.MeshLambertMaterial({ color: 0xff0000, side: THREE.DoubleSide }),
    x: new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.DoubleSide }),
}
