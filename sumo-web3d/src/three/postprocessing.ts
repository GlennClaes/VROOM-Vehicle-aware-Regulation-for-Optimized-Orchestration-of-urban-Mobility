// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import { GUI } from 'dat.gui';
import * as three from 'three';
import {
    CopyShader,
    EffectComposer,
    RenderPass,
    ShaderPass,
    SMAAPass,
    SSAOPass,
} from './vendor-shaders';

const FOG_COLOR = 0xffffff;
export const FOG_RATE = 0.00005;

export default class Effects {
    private camera: three.Camera;
    private scene: three.Scene;
    private renderer: three.WebGLRenderer;
    private gui: GUI;

    private composer!: EffectComposer;
    private effectsEnabled!: {
        ssao: boolean;
        smaa: boolean;
        fog: boolean;
    };
    private ssaoPass?: SSAOPass;
    private ssaoParams!: {
        cameraNear: number;
        cameraFar: number;
        radius: number;
    };
    private smaaPass?: SMAAPass;
    private fog: three.FogExp2;

    constructor(
        camera: three.Camera,
        scene: three.Scene,
        renderer: three.WebGLRenderer,
        gui: GUI,
        width: number,
        height: number,
    ) {
        this.camera = camera;
        this.scene = scene;
        this.renderer = renderer;
        this.gui = gui;

        this.fog = new three.FogExp2(FOG_COLOR, FOG_RATE);
        this.scene.fog = null; // Fog disabled by default for max brightness

        this.initPostprocessing(width, height);
        this.onResize(width, height);
    }

    private initPostprocessing(width: number, height: number) {
        // 1. Definieer eerst de parameters
        this.ssaoParams = {
            cameraNear: 7,
            cameraFar: 3000,
            radius: 4,
        };

        // 2. Maak de passes aan
        const renderPass = new RenderPass(this.scene, this.camera);
        const copyPass = new ShaderPass(CopyShader);
        copyPass.renderToScreen = true;

        // 4. De update functie
        const updateSSAO = () => {
            if (!this.ssaoPass) return;
            this.ssaoPass.kernelRadius = this.ssaoParams.radius;
        };

        // 5. GUI Setup
        const effectsFolder = this.gui.addFolder('Effects');
        const ssaoFolder = this.gui.addFolder('SSAO');

        ssaoFolder.add(this.ssaoParams, 'cameraNear', 0.1, 100).onChange(updateSSAO);
        ssaoFolder.add(this.ssaoParams, 'cameraFar', 100, 5000).onChange(updateSSAO);
        ssaoFolder.add(this.ssaoParams, 'radius', 1, 256).onChange(updateSSAO);

        // 6. Composer samenstellen
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);
        this.composer.addPass(copyPass);

        this.effectsEnabled = {
            ssao: false,
            smaa: false, // Disabled by default
            fog: false,
        };

        effectsFolder.add(this.effectsEnabled, 'smaa').onChange((v: boolean) => {
            if (v && !this.smaaPass) {
                this.smaaPass = new SMAAPass(width, height);
                this.composer.insertPass(this.smaaPass, 1); // Insert after RenderPass
            }
            if (this.smaaPass) {
                this.smaaPass.enabled = v;
            }
        });
        effectsFolder.add(this.effectsEnabled, 'ssao').onChange((v: boolean) => {
            if (v && !this.ssaoPass) {
                this.ssaoPass = new SSAOPass(this.scene, this.camera, width, height);
                updateSSAO();
                this.composer.insertPass(this.ssaoPass, 2); // Insert after SMAAPass/RenderPass
            }
            if (this.ssaoPass) {
                this.ssaoPass.enabled = v;
            }
        });
        effectsFolder.add(this.effectsEnabled, 'fog').onChange((v: boolean) => {
            this.scene.fog = v ? this.fog : null;
        });
    }

    render() {
        if ((!this.smaaPass || !this.smaaPass.enabled) && (!this.ssaoPass || !this.ssaoPass.enabled)) {
            this.renderer.render(this.scene, this.camera);
        } else {
            this.composer.render();
        }
    }

    onResize(width: number, height: number, pixelRatio: number = window.devicePixelRatio) {
        const cappedRatio = Math.min(pixelRatio, 1.5);
        const newWidth = Math.floor(width * cappedRatio) || width;
        const newHeight = Math.floor(height * cappedRatio) || height;

        if (this.composer) {
            this.composer.setSize(newWidth, newHeight);
        }

        if (this.ssaoPass) {
            this.ssaoPass.setSize(newWidth, newHeight);
        }
        if (this.smaaPass) {
            this.smaaPass.setSize(newWidth, newHeight);
        }
    }
}
