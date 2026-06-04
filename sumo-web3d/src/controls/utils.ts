import * as THREE from 'three'

export function createYAxisRotationMatrix3(angleRad: number): THREE.Matrix3 {
    const matrix = new THREE.Matrix3()
    matrix.set(
        Math.cos(angleRad), 0, Math.sin(angleRad),
        0,                  1, 0,
        -Math.sin(angleRad),0, Math.cos(angleRad),
    )
    return matrix
}

export function createXAxisRotationMatrix4(angleRad: number): THREE.Matrix4 {
    const matrix = new THREE.Matrix4()
    matrix.set(
        1, 0,               0,              0,
        0, Math.cos(angleRad), -Math.sin(angleRad), 0,
        0, Math.sin(angleRad),  Math.cos(angleRad), 0,
        0, 0,               0,              1,
    )
    return matrix
}

function makeXZPlaneMatrix4(): THREE.Matrix4 {
    // Camera looking straight along -Z axis (horizon)
    const matrix = new THREE.Matrix4()
    matrix.set(1, 0, 0, 0,  0, 0, -1, 0,  0, 1, 0, 0,  0, 0, 0, 1)
    return matrix
}

export const XZPlaneMatrix4 = makeXZPlaneMatrix4()

export function rotateInWorldSpace(
    object: THREE.Object3D,
    axis: THREE.Vector3,
    radians: number,
) {
    const rotWorldMatrix = new THREE.Matrix4()
    rotWorldMatrix.makeRotationAxis(axis.normalize(), radians)
    const worldMatrix = new THREE.Matrix4().makeRotationFromQuaternion(
        object.getWorldQuaternion(new THREE.Quaternion()),
    )
    rotWorldMatrix.multiply(worldMatrix)
    object.rotation.setFromRotationMatrix(rotWorldMatrix)
}
