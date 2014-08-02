/// <reference path="../biz.turbulenz/0.27/jslib-modular/turbulenz.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/vmath.d.ts" />
/// <reference path="../biz.turbulenz/0.27/jslib-modular/jsengine_base.d.ts" />
declare class DynamicCameraController {
    public version: number;
    public transformTypes: {
        linear: number;
    };
    public cameraType: {
        fixed: number;
        rail: number;
        chase: number;
    };
    public gd: GraphicsDevice;
    public md: MathDevice;
    public camera: Camera;
    public curMode: number;
    public camTargetPos: any;
    public transformMode: number;
    public rate: number;
    public chaseRate: number;
    public currentTime: number;
    public startTime: number;
    public endTime: number;
    public camCurUp: any;
    public trackCurPos: any;
    public isTracking: boolean;
    public setRate(rate: any): void;
    public setChaseRate(rate: any): void;
    public setTracking(isTracking: any): void;
    public setCameraTargetPos(pos: any, time?: any, delta?: any): void;
    public setTrackTarget(pos: any): void;
    public setCameraMode(mode: any): boolean;
    public snapCameraToTarget(): void;
    public isCameraAtTarget(): boolean;
    public getLookAtMatrix(): any;
    public transform(delta: any): void;
    public rotate(): void;
    public update(delta: any): void;
    static create(camera: Camera, gd: GraphicsDevice): DynamicCameraController;
}
