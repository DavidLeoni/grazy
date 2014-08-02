/// <reference path="../../../../../../stolang/js/com.jquery/jquery.d.ts" />
/// <reference path="../../../stolang/ts/org.stocas.lang/stolang.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/turbulenz.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/servicedatatypes.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/services.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/aabbtree.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/jsengine_base.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/jsengine.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/fontmanager.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/utilities.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/tzdraw2d.d.ts" />
/// <reference path="../../../../../../stovis/js/biz.turbulenz/0.27/jslib-modular/physics2d.d.ts" />
/// <reference path="htmlcontrols.d.ts" />
declare var WebGLTurbulenzEngine: any;
declare var canvasSupported: boolean;
declare module physics2DConstraintsTest {
    var DEFAULT_BACKGROUND_COLOR: string;
    var DEFAULT_FILL_COLOR: string;
    var DEFAULT_STROKE_COLOR: string;
    /** max field size in pixel */
    var MAX_FIELD_LENGTH: number;
    class Editor {
        /**
        Labels to put on nodes
        */
        static labels: string[];
        constructor(container: HTMLElement);
    }
    function addEditor(container: HTMLElement): Editor;
}
