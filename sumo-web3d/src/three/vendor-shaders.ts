import * as THREE from 'three';

// Passes
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';

// Shaders
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { SSAOShader } from 'three/examples/jsm/shaders/SSAOShader.js';
import { SMAAEdgesShader, SMAAWeightsShader, SMAABlendShader } from 'three/examples/jsm/shaders/SMAAShader.js';

// Export
export {
    THREE,
    EffectComposer,
    RenderPass,
    ShaderPass,
    SMAAPass,
    SSAOPass,
    CopyShader,
    SSAOShader,
    SMAAEdgesShader,
    SMAAWeightsShader,
    SMAABlendShader
};
