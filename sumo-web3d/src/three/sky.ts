import * as THREE from 'three'

export default function addSky(scene: THREE.Scene, isEditor: boolean) {
    if (isEditor) {
        scene.background = new THREE.Color(0xdceffa) // default light blue
    } else {
        // Brighten up the sky color significantly
        scene.background = new THREE.Color(0xdceffa)
    }

    // Realistic sunlight: warm hue, high intensity
    const directionalLight = new THREE.DirectionalLight(0xfffae6, 3.0)
    directionalLight.position.set(-100, 200, -100)

    // We already disabled shadowMap globally in renderer for FPS, but we set these
    // properties correctly just in case it is ever toggled back on.
    directionalLight.castShadow = true
    directionalLight.shadow.camera.near = 10
    directionalLight.shadow.camera.far = 1000
    directionalLight.shadow.mapSize.width = 1024
    directionalLight.shadow.mapSize.height = 1024

    // Zeer helder omgevingslicht voor maximale zichtbaarheid
    const ambientLight = new THREE.AmbientLight(0xffffff, 4.0)

    scene.add(ambientLight)
    scene.add(directionalLight)
}
