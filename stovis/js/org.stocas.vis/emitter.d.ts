/// <reference path="../biz.turbulenz/0.27/jslib-modular/turbulenz.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/servicedatatypes.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/services.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/aabbtree.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/jsengine_base.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/jsengine.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/fontmanager.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/utilities.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/tzdraw2d.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/physics2d.d.ts" />
/// <reference path="htmlcontrols.d.ts" />
interface Particle {
    velocity: any;
    position: any;
    dieTime: number;
    size: number;
    color: any;
    invlifeTime: number;
}
declare class ParticleSystem {
    static version: number;
    public md: MathDevice;
    public numActiveParticles: number;
    public spawnNextParticle: number;
    public worldPosition: any;
    public particles: Particle[];
    public dirtyWorldExtents: boolean;
    public colorList: any[];
    public v3temp: any;
    public extents: Float32Array;
    public maxSpawnTime: number;
    public minSpawnTime: number;
    public diffSpawnTime: number;
    public maxLifetime: number;
    public minLifetime: number;
    public diffLifetime: number;
    public size: number;
    public growRate: number;
    public maxParticles: number;
    public gravity: number;
    public geometryInstance: GeometryInstance;
    public indexBuffer: IndexBuffer;
    public setWorldPosition(worldPosition: any): void;
    public createParticle(particle: any): void;
    public initialize(): void;
    public update(currentTime: any, deltaTime: any): void;
    public getWorldExtents(): Float32Array;
    public destroy(): void;
    static create(md: MathDevice, gd: GraphicsDevice, parameters: any): ParticleSystem;
}
declare class ParticleSystemRenderer {
    static version: number;
    public gd: GraphicsDevice;
    public md: MathDevice;
    public update(particleSystem: any, camera: any): void;
    public updateRenderableWorldExtents(particleSystem: any): void;
    public initialize(particleSystem: any, material: any, node: any): void;
    public destroy(particleSystems: any): void;
    static create(gd: GraphicsDevice, md: MathDevice): ParticleSystemRenderer;
}
declare class Emitter {
    static version: number;
    public gd: GraphicsDevice;
    public md: MathDevice;
    public particleSystem: ParticleSystem;
    public particleSystemRenderer: ParticleSystemRenderer;
    public material: Material;
    public node: SceneNode;
    public updateExtentsTime: number;
    public update(currentTime: any, deltaTime: any, camera: any): void;
    public setMaterial(material: any): void;
    public setParticleColors(colorList: any): void;
    public getNumActiveParticles(): number;
    public destroy(): void;
    static create(gd: GraphicsDevice, md: MathDevice, material: any, node: any, parameters: any): Emitter;
}
