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
declare module stovis {
    var STOVIS_PREFIX: string;
    var STOVIS_IRI: string;
    var DEFAULT_BACKGROUND_COLOR: string;
    var DEFAULT_FILL_COLOR: number[];
    var DEFAULT_STROKE_COLOR: string;
    var DEFAULT_RADIUS: number;
    /** max field size in pixel */
    var MAX_FIELD_LENGTH: number;
    class Node {
        public id: number;
        public rdfNode: Rdfstore.RDFNode;
        public body: Physics2DRigidBody;
        public pin: Physics2DConstraint;
        constructor(id: number, rdfNode: Rdfstore.RDFNode, body: Physics2DRigidBody);
        public radius : number;
    }
    class Relation {
        public id: number;
        public nodeA: Node;
        public nodeB: Node;
        public constraint: Physics2DConstraint;
        public relationUrl: string;
        constructor(id: number, nodeA: Node, nodeB: Node, constraint: Physics2DConstraint, relationUrl: string);
    }
    class Editor {
        /**
        Labels to put on nodes
        */
        static labels: string[];
        public htmlControls: HTMLControls;
        public elasticConstraints: boolean;
        public frequency: number;
        public damping: number;
        public graphicsDevice: GraphicsDevice;
        public mathDevice: MathDevice;
        public requestHandler: RequestHandler;
        public fontManager: FontManager;
        public shaderManager: ShaderManager;
        public font: any;
        public shader: any;
        public gameSession: GameSession;
        public phys2D: Physics2DDevice;
        public stageWidth: number;
        public stageHeight: number;
        public draw2D: Draw2D;
        public debug: Physics2DDebugDraw;
        public framesPerSecond: number;
        public debugEnabled: boolean;
        public debugMessagesPerSecond: number;
        public contactsEnabled: boolean;
        public world: Physics2DWorld;
        public staticReferenceBody: Physics2DRigidBody;
        public thickness: number;
        public handConstraint: Physics2DConstraint;
        public inputDevice: InputDevice;
        public keyCodes: any;
        public mouseCodes: any;
        public mouseX: number;
        public mouseY: number;
        public realTime: number;
        public prevTime: number;
        public fontTechnique: Technique;
        public fontTechniqueParameters: any;
        public addNodeNearCenter(label: string): void;
        public unpinNode(node: any): void;
        public pinNode(node: Node): void;
        /**
        Yeah, let's make some discouraged-yet-possible weird number indexed objects. See http://mathiasbynens.be/notes/javascript-properties
        */
        public nodeMap: {
            [id: number]: Node;
        };
        public relationMap: {
            [id: number]: Relation;
        };
        /**
        
        */
        public addRelation(nodeA: Node, predicateUrl: string, nodeB: Node): Relation;
        public addNode(x: number, y: number, radius: number, iri: string): Node;
        public circle(x: any, y: any, radius: any, pinned?: boolean): Physics2DRigidBody;
        public reset(): void;
        public invalidateConstraints(): void;
        public segmentFont(x: any, y: any, text: any, height: any): void;
        /**
        x and y are the upper left corner of the text. i.e. 0,0 for upper left corner of the screen
        width, height: i.e. 10,10 for a box like in physics 2d contraints example.
        Currently they don't even work, in theory they are needed to define the maximum allowed region where to draw
        Semms like a font has width and height of 1.0, when scaling factor is 1.0
        todo should determine scale / linebreaks accordingly.
        todo - is this the right place to set fontTechnique? guess not.
        */
        public drawCenteredText(x: number, y: number, text: string, width: number, height: number): void;
        public drawNode(node: Node): void;
        public mainLoop(): void;
        private loadHtmlControls();
        public visStore: Rdfstore.Store;
        public visGraph: any;
        public nodeIdCounter: number;
        public relationIdCounter: number;
        constructor(container: HTMLElement);
    }
    function addEditor(container: HTMLElement): Editor;
}
