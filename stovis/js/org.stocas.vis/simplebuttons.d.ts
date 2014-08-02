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
interface SimpleButtonParams {
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    callback: () => void;
    hoverCallback?: () => void;
}
interface SimpleButton {
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    callback: () => void;
    hoverCallback?: () => void;
    hovering: boolean;
}
declare class SimpleButtonManager {
    static buttons: {
        [id: string]: SimpleButton;
    };
    static mouseX: number;
    static mouseY: number;
    static loopButtons(callback: any): void;
    static checkOverlap(x: any, y: any, button: any): boolean;
    static init(inputDevice: InputDevice): void;
    static addButton(params: SimpleButtonParams): void;
    static clearButtons(): void;
}
