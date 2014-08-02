// Copyright (c) 2010-2011 Turbulenz Limited

//
//  SceneLoader
//  ===========
//
//  Helper class to load() a scene and wait for its dependencies before complete() is true
//

/*global TurbulenzEngine: false*/
/*global ResourceLoader: false*/

/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/turbulenz.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/servicedatatypes.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/services.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/aabbtree.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/jsengine_base.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/jsengine.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/fontmanager.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/utilities.d.ts" />

/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/tzdraw2d.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/physics2d.d.ts" />
/// <reference path="htmlcontrols.ts" />

class SceneLoader
{
    scene: Scene;
    assetPath: string;
    textureManager: TextureManager;
    shaderManager: ShaderManager;
    effectManager: EffectManager;
    animationManager: AnimationManager;
    preSceneLoadFn: { (sceneData: any): void; };
    postSceneLoadFn: { (scene: Scene): void; };
    dependenciesLoaded: boolean;
    sceneAssetsRequested: boolean;
    pathRemapping: { [path: string]: string; };
    pathPrefix: string;
    requestHandler: RequestHandler;
    keepLights: boolean;
    keepCameras: boolean;
    sceneLoaded: boolean;
    request: { (url: string, onload: any): void; };

    complete()
    {
        if (!this.dependenciesLoaded)
        {
            if (this.sceneAssetsRequested &&
                0 === this.textureManager.getNumPendingTextures() &&
                (!this.shaderManager || 0 === this.shaderManager.getNumPendingShaders()))
            {
                this.dependenciesLoaded = true;
            }
        }
        return this.dependenciesLoaded;
    }

    load(parameters)
    {
        var sceneLoader = this; // required for context in nested functions

        this.sceneAssetsRequested = false;

        this.scene = parameters.scene;
        this.assetPath = parameters.assetPath;
        this.textureManager = parameters.textureManager;
        this.shaderManager = parameters.shaderManager;
        this.effectManager = parameters.effectManager;
        this.animationManager = parameters.animationManager;
        this.requestHandler = parameters.requestHandler;

        if (parameters.keepLights !== undefined)
        {
            this.keepLights = parameters.keepLights;
        }
        if (parameters.keepCameras !== undefined)
        {
            this.keepCameras = parameters.keepCameras;
        }
        this.preSceneLoadFn = parameters.preSceneLoadFn;
        this.postSceneLoadFn = parameters.postSceneLoadFn;
        this.dependenciesLoaded = false;
        this.sceneLoaded = false;

        if (!parameters.append)
        {
            this.scene.clear();
        }

        var pathRemapping = this.pathRemapping;
        var requestHandler = this.requestHandler;
        function requestFn(url, onload)
        {
            requestHandler.request({
                    src: (pathRemapping && pathRemapping[url]) || (this.pathPrefix + url),
                    onload: onload
                });
        }

        if (parameters.request)
        {
            this.request = parameters.request;
        }
        else
        {
            this.request = requestFn;
        }

        // Create a callback for post scene load
        function loadSceneFinishedFn()
        {
            if (sceneLoader.postSceneLoadFn)
            {
                //Add custom logic
                sceneLoader.postSceneLoadFn(sceneLoader.scene);
            }
            sceneLoader.sceneAssetsRequested = true;
        }

        // Callback function to pass to the below request()
        function sceneReceivedFn(text /*, status */)
        {
            var sceneData = JSON.parse(text);

            if (!sceneData)
            {
                // Doesn't exist, create an empty data object to preload into the scene
                sceneData = {};
            }

            if (parameters.preSceneLoadFn)
            {
                //Add custom nodes
                parameters.preSceneLoadFn(sceneData);
            }

            // Set a yield callback for loading, for the sample don't do anything special
            function sceneLoadYieldFn(callback)
            {
                TurbulenzEngine.setTimeout(callback, 0);
            }

            function begetFn(o)
            {
                var F = function () { };
                F.prototype = o;
                return new F();
            }

            var loadParameters = begetFn(parameters);

            // Set a sceneLoad callback to load the resource into the scene
            function sceneLoadFn(resolvedData)
            {
                // If we were supplied an animation manager, let that load any animations from the resolved data
                if (sceneLoader.animationManager)
                {
                    sceneLoader.animationManager.loadData(resolvedData);
                }

                loadParameters.data = resolvedData;
                loadParameters.yieldFn = sceneLoadYieldFn;
                loadParameters.onload = loadSceneFinishedFn;

                sceneLoader.scene.load(loadParameters);
            }

            // Create a resource loader to resolve any references in the scene data
            var resourceLoader = ResourceLoader.create();
            resourceLoader.resolve({
                data : sceneData,
                request : this.request,
                onload : sceneLoadFn,
                requestHandler : requestHandler
            });
        }

        this.request(parameters.assetPath, sceneReceivedFn);
    }

    setPathRemapping(prm, assetUrl)
    {
        this.pathRemapping = prm;
        this.pathPrefix = assetUrl;
    }

    static create()
    {
        var sceneLoader = new SceneLoader();

        sceneLoader.scene = null;
        sceneLoader.assetPath = null;
        sceneLoader.textureManager = null;
        sceneLoader.shaderManager = null;
        sceneLoader.effectManager = null;
        sceneLoader.animationManager = null;
        sceneLoader.preSceneLoadFn = null;
        sceneLoader.postSceneLoadFn = null;
        sceneLoader.dependenciesLoaded = false;
        sceneLoader.sceneAssetsRequested = false;

        sceneLoader.pathPrefix = "";

        return sceneLoader;
    }
}
