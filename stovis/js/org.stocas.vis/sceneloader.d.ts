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
declare class SceneLoader {
    public scene: Scene;
    public assetPath: string;
    public textureManager: TextureManager;
    public shaderManager: ShaderManager;
    public effectManager: EffectManager;
    public animationManager: AnimationManager;
    public preSceneLoadFn: (sceneData: any) => void;
    public postSceneLoadFn: (scene: Scene) => void;
    public dependenciesLoaded: boolean;
    public sceneAssetsRequested: boolean;
    public pathRemapping: {
        [path: string]: string;
    };
    public pathPrefix: string;
    public requestHandler: RequestHandler;
    public keepLights: boolean;
    public keepCameras: boolean;
    public sceneLoaded: boolean;
    public request: (url: string, onload: any) => void;
    public complete(): boolean;
    public load(parameters: any): void;
    public setPathRemapping(prm: any, assetUrl: any): void;
    static create(): SceneLoader;
}
