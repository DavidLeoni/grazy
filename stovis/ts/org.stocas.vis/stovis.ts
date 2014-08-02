
/// <reference path="../../../stolang/js/com.jquery/jquery.d.ts" />
/// <reference path="../../../stolang/ts/org.stocas.lang/stolang.ts" />

 
/*global TurbulenzEngine: true */
/*global TurbulenzServices: false */
/*global RequestHandler: false */
/*global Physics2DDevice: false */
/*global Draw2D: false */
/*global Draw2DSprite: false */
/*global Physics2DDebugDraw: false */
/*global HTMLControls: false */

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


// Could not find definition in typescript files
declare var WebGLTurbulenzEngine: any;
// defined in index.html, comes from the demo
declare var canvasSupported: boolean;


// Module
module stovis {

    export var STOVIS_PREFIX = "stovis";   
    export var STOVIS_IRI = "https://github.com/davidleoni/stovis";   
    export var DEFAULT_BACKGROUND_COLOR = "#2e2e2e";
    export var DEFAULT_FILL_COLOR = [1, 1, 1, 1]; // "#ffbaba";
    export var DEFAULT_STROKE_COLOR = "#ff7a7a";
    export var DEFAULT_RADIUS = 1.0;
    /** max field size in pixel */
    export var MAX_FIELD_LENGTH = 20000;

    /**
        Experimental - Not using it. Kept here to experiment about ui encapsulation/ web components / whatever 
    */
    class ExperimentalElem {

    }
    
    export class JsonLd {
			"@id" : string;			
	}

    export class VisNode {
        id: number;
        rdfNode: Rdfstore.RDFNode;
        body: Physics2DRigidBody;
        pin: Physics2DConstraint;
        constructor(id: number, rdfNode: Rdfstore.RDFNode, body: Physics2DRigidBody) {
            this.id = id;
            this.rdfNode = rdfNode;
            this.body = body;
            this.pin = null;
        }
        get radius() : number {
            var circle = this.body.shapes[0];
            // assuming a circle body - these constants are awful! Don't they have a CircleShape class??           
            var data = circle._data;
            return data[(/*CIRCLE_RADIUS*/6)];            
        }
    }

    export class Relation {
        id: number;
        nodeA: VisNode;
        nodeB: VisNode;
        constraint: Physics2DConstraint;
        relationUrl: string;
        constructor(id: number, nodeA: VisNode, nodeB: VisNode, constraint: Physics2DConstraint, relationUrl: string) {
            this.id = id;
            this.nodeA = nodeA;
            this.nodeB = nodeB;
            this.constraint = constraint;
            this.relationUrl = relationUrl;
        }
    }



    export class Editor {

        /** 
            Labels to put on nodes 
        */
        static labels: Array<string> = ["L", "[]", "head", "tail"];

        htmlControls: HTMLControls;

        elasticConstraints = false;
        frequency = 1;
        damping = 0.1;

        graphicsDevice: GraphicsDevice;
        mathDevice: MathDevice;
        requestHandler: RequestHandler;

        fontManager: FontManager;
        shaderManager: ShaderManager;

        font: any;
        shader: any;
        gameSession: GameSession;

        phys2D: Physics2DDevice;

        stageWidth: number;
        stageHeight: number;

        draw2D: Draw2D;

        debug: Physics2DDebugDraw;

        framesPerSecond: number;

        debugEnabled: boolean;
        debugMessagesPerSecond: number; // integer;
        contactsEnabled: boolean;


        world: Physics2DWorld;

        staticReferenceBody: Physics2DRigidBody;

        thickness = 0.01;

        handConstraint: Physics2DConstraint;

        inputDevice: InputDevice;
        keyCodes: any;
        mouseCodes: any;

        mouseX: number;
        mouseY: number;

        realTime: number;
        prevTime: number;

        fontTechnique: Technique;
        fontTechniqueParameters: any;


        addNodeNearCenter(label: string) {
            throw new Error("Implement me!");
        }

        unpinNode(node) {
            if (node.pin) {
                this.world.removeConstraint(node.pin);    
            }
        }

        pinNode(node: VisNode) {

            if (!node.pin) {
                var pos = node.body.getPosition();
                node.pin = this.phys2D.createPointConstraint({
                    bodyA: this.staticReferenceBody,
                    bodyB: node.body,
                    anchorA: pos,
                    anchorB: [0, 0],
                    userData: "pin"
                });
                this.world.addConstraint(node.pin);                
            }

        }

        /**
        Yeah, let's make some discouraged-yet-possible weird number indexed objects. See http://mathiasbynens.be/notes/javascript-properties
        */
        nodeMap: { [id: number]: VisNode; };
        relationMap: { [id: number]: Relation; };
		
		
		
		/**
			 For each key in the object, a new node is created. Nodes IRI must be present in "@id" field
			 @return Returns the root node.  
		*/					
		/* addTree(treeObj : JsonLd) : VisNode {
        
			
			new VisNode(
			$.each(treeObj, (k)=>{
				var v = treeObj[k];
				if (k !== "@id"){
					if ($.isPlainObject(v) && v["@id"]){
						//new Relation( addTree(v["@id"]);
						// constructor(id: number, nodeA: VisNode, nodeB: VisNode, constraint: Physics2DConstraint, relationUrl: string) {
					} else {						
						throw new Error("Only JsonLd objects are supported as field values!");						
					}			
				};
							
			}); 
		} */
		
		/**
        	Adds a relation both to the rdf store and to the physical simulator    
        */
        addRelation(nodeA: VisNode, predicateUrl: string, nodeB: VisNode) : Relation {

            this.visStore.execute('INSERT DATA {  <' + nodeA.rdfNode.nominalValue + '> <' + predicateUrl + '> <' + nodeB.rdfNode.nominalValue + '> }');   

            var bodyA = nodeA.body;
            var bodyB = nodeB.body;

            var loBound = nodeA.radius + nodeB.radius + 2.0 * DEFAULT_RADIUS;
            var upBound = loBound + 2.0 * DEFAULT_RADIUS;


            var distanceConstraint = this.phys2D.createDistanceConstraint({
                bodyA: bodyA,
                bodyB: bodyB,
                anchorA: [0.0, 0.0],
                anchorB: [0.0, 0.0],
                lowerBound: loBound,
                upperBound: upBound,
                stiff: (!this.elasticConstraints),
                frequency: this.frequency,
                damping: this.damping
            });

            this.world.addConstraint(distanceConstraint);   
            this.relationIdCounter += 1;             
            var relation = new Relation(this.relationIdCounter, nodeA, nodeB, distanceConstraint, predicateUrl);
            this.relationMap[relation.id] = relation;
            return relation;
        }

        addNode(x: number, y: number, radius: number, iri: string) : VisNode {
            var vs = this.visStore;            
            var rdfNode = vs.rdf.createNamedNode(iri);
  
            var node = new VisNode(null, rdfNode, null);


                        
            vs.execute('INSERT DATA {  <' + iri + '> <rdfs:label> "' + vs.rdf.terms.shrink(iri) +'" }');            


            var body = this.phys2D.createRigidBody({                
                shapes: [
                    this.phys2D.createCircleShape({
                        radius: radius
                    })
                ],
                position: [x, y],
                userData: node
            });
            node.body = body;
            this.world.addRigidBody(body);    
            this.nodeIdCounter += 1;
            node.id = this.nodeIdCounter;
            this.nodeMap[this.nodeIdCounter] = node;

            return node;
        }

        circle(x, y, radius, pinned?: boolean) {
            var body = this.phys2D.createRigidBody({
                shapes: [
                    this.phys2D.createCircleShape({
                        radius: radius
                    })
                ],
                position: [x, y]
            });
            this.world.addRigidBody(body);

            if (pinned) {
                var pin = this.phys2D.createPointConstraint({
                    bodyA: this.staticReferenceBody,
                    bodyB: body,
                    anchorA: [x, y],
                    anchorB: [0, 0],
                    userData: "pin"
                });
                this.world.addConstraint(pin);
            }

            return body;
        }


        reset() {
            // Remove all bodies and constraints from world.
            this.world.clear();
            this.handConstraint = null;

            // Create a static body around the stage to stop objects leaving the viewport.
            // And walls between each constraint section.
            var border = this.phys2D.createRigidBody({
                type: 'static'
            });


            var i;
            for (i = 0; i <= 4; i += 1) {
                var x = (this.stageWidth / 4) * i;
                border.addShape(this.phys2D.createPolygonShape({
                    vertices: this.phys2D.createRectangleVertices(x - this.thickness, 0, x + this.thickness, this.stageHeight)
                }));
            }
            for (i = 0; i <= 2; i += 1) {
                var y = (this.stageHeight / 2) * i;
                border.addShape(this.phys2D.createPolygonShape({
                    vertices: this.phys2D.createRectangleVertices(0, y - this.thickness, this.stageWidth, y + this.thickness)
                }));
            }

            this.world.addRigidBody(border);


            var bodyA, bodyB, worldAnchor;

            // ------------------------------------
            // tree layout

            var nodeC = this.addNode(2, 2, DEFAULT_RADIUS, "C");
            var nodeD = this.addNode(8, 2, DEFAULT_RADIUS, "D");

            var nodeA = this.addNode(3.3, 5, DEFAULT_RADIUS, "A");
            var nodeB = this.addNode(6.6, 5, DEFAULT_RADIUS, "B");
            
            this.addRelation(nodeA, "myrel", nodeB);
            this.addRelation(nodeA, "myrel", nodeC);
            this.addRelation(nodeC, "myrel", nodeD);


             this.visStore.execute("SELECT * { ?s ?p ?o }", function (success, results) {
                console.log("success: ", success);
                console.log("results: ", results);
                
            });
            
            console.log("visStore2 = ", this.visStore);
            



            // ------------------------------------
            // Weld Constraint
            bodyA = this.circle(13.3, 5, 1);
            bodyB = this.circle(16.6, 5, 1);

            worldAnchor = [15, 5];
            var weldConstraint = this.phys2D.createWeldConstraint({
                bodyA: bodyA,
                bodyB: bodyB,
                anchorA: bodyA.transformWorldPointToLocal(worldAnchor),
                anchorB: bodyB.transformWorldPointToLocal(worldAnchor),
                phase: 0,
                stiff: (!this.elasticConstraints),
                frequency: this.frequency,
                damping: this.damping
            });
            this.world.addConstraint(weldConstraint);

            // ------------------------------------
            // Distance Constraint
            bodyA = this.circle(23.3, 5, 1);
            bodyB = this.circle(26.6, 5, 1);

            var distanceConstraint = this.phys2D.createDistanceConstraint({
                bodyA: bodyA,
                bodyB: bodyB,
                anchorA: [1, 0],
                anchorB: [-1, 0],
                lowerBound: 1,
                upperBound: 3,
                stiff: (!this.elasticConstraints),
                frequency: this.frequency,
                damping: this.damping
            });
            this.world.addConstraint(distanceConstraint);

            // ------------------------------------
            // Line Constraint
            bodyA = this.circle(33.3, 5, 1);
            bodyB = this.circle(36.6, 5, 1);

            worldAnchor = [35, 5];
            var lineConstraint = this.phys2D.createLineConstraint({
                bodyA: bodyA,
                bodyB: bodyB,
                anchorA: bodyA.transformWorldPointToLocal(worldAnchor),
                anchorB: bodyB.transformWorldPointToLocal(worldAnchor),
                axis: [0, 1],
                lowerBound: -1,
                upperBound: 1,
                stiff: (!this.elasticConstraints),
                frequency: this.frequency,
                damping: this.damping
            });
            this.world.addConstraint(lineConstraint);

      
        }

        invalidateConstraints() {
            var constraints = this.world.constraints;
            var limit = constraints.length;
            var i;
            for (i = 0; i < limit; i += 1) {
                var con = constraints[i];

                if (con === this.handConstraint || con.userData === "pin") {
                    continue;
                }

                con.configure({
                    stiff: (!this.elasticConstraints),
                    frequency: this.frequency,
                    damping: this.damping
                });
            }
        }

        segmentFont(x, y, text, height) {
            var topLeft = this.draw2D.viewportUnmap(x, y);
            var bottomRight = this.draw2D.viewportUnmap(x + 10, y + height);
            this.font.drawTextRect(text, {
                rect: [topLeft[0], topLeft[1], bottomRight[0] - topLeft[0], bottomRight[1] - topLeft[1]],
                scale: 1.0,
                spacing: 0,
                alignment: 1
            });
        }

        /**
            x and y are the upper left corner of the text. i.e. 0,0 for upper left corner of the screen
            width, height: i.e. 10,10 for a box like in physics 2d contraints example. 
            Currently they don't even work, in theory they are needed to define the maximum allowed region where to draw
            Semms like a font has width and height of 1.0, when scaling factor is 1.0
            todo should determine scale / linebreaks accordingly. 
            todo - is this the right place to set fontTechnique? guess not.
        */
        drawCenteredText(x: number, y: number, text: string, width: number, height: number) {
            // Notice long text will exceed width.Height is not even taken into account by Turbulenz
            /** fonts won't exceed this width */
            var fontWidth = 1.0;
            /** fonts won't exceed this height */
            var fontHeight = 1.0;
            var fontSpacing = 0.0
            var topLeft = this.draw2D.viewportUnmap(x - text.length / 2, y - fontHeight / 2);
            var bottomRight = this.draw2D.viewportUnmap(x + text.length / 2, y + fontHeight / 2);

            this.graphicsDevice.setTechnique(this.fontTechnique);
            this.fontTechniqueParameters.clipSpace = this.mathDevice.v4Build(2 / this.graphicsDevice.width, -2 / this.graphicsDevice.height, -1, 1, this.fontTechniqueParameters.clipSpace);
            this.graphicsDevice.setTechniqueParameters(this.fontTechniqueParameters);

            this.font.drawTextRect(text, {
                // NOTICE:  rect: [x, y, width, height] Currently, the height is always ignored
                rect: [topLeft[0], topLeft[1], bottomRight[0] - topLeft[0], bottomRight[1] - topLeft[1]],
                scale: 1.0,
                spacing: fontSpacing,
                alignment: 1 //  center aligned
            });
        }

        drawNode(node: VisNode) {
            // console.log("Drawing node", node);
            var pos = node.body.getPosition();
            var circle = node.body.shapes[0];
            // assuming a circle body - these constants are awful! Don't they have a CircleShape class??           
            var data = circle._data;
            var radius = data[(/*CIRCLE_RADIUS*/6)];

            this.debug.drawRigidBody(node.body);
            if (this.world.timeStamp % (Math.floor(this.framesPerSecond / this.debugMessagesPerSecond)) === 0) {
                //console.log("pos[0] : ", pos[0], "pos[1] : ", pos[1], "radius : ", radius);                
            }


            this.drawCenteredText(pos[0], pos[1], node.rdfNode.nominalValue, radius, radius);
        }

        mainLoop() {
            if (!this.graphicsDevice.beginFrame()) {
                return;
            }

            this.inputDevice.update();
            this.graphicsDevice.clear([0.3, 0.3, 0.3, 1.0]);

            if (this.handConstraint) {
                this.handConstraint.setAnchorA(this.draw2D.viewportMap(this.mouseX, this.mouseY));
            }

            var curTime = TurbulenzEngine.time;
            var timeDelta = (curTime - this.prevTime);

            if (timeDelta > (1 / 20)) {
                timeDelta = (1 / 20);
            }
            this.realTime += timeDelta;
            this.prevTime = curTime;

            while (this.world.simulatedTime < this.realTime) {
                this.world.step(1 / this.framesPerSecond);
            }



            // draw2D sprite drawing.
            var bodies = this.world.rigidBodies;
            var limit = bodies.length;
            var i;
            if (!this.debugEnabled) {
                this.draw2D.begin('alpha', 'deferred');
                var pos = [];
                for (i = 0; i < limit; i += 1) {
                    var body = bodies[i];
                    if (body.userData) {
                        body.getPosition(pos);
                        var node = body.userData;
                        this.drawNode(node);
                    }
                }
                this.draw2D.end();
            }

            // physics2D debug drawing.
            this.debug.setScreenViewport(this.draw2D.getScreenSpaceViewport());
            this.debug.showRigidBodies = this.debugEnabled;
            this.debug.showContacts = this.contactsEnabled;

            this.debug.begin();
            if (!this.debugEnabled) {
                for (i = 0; i < limit; i += 1) {
                    var body = bodies[i];
                    if (!body.userData) {
                        this.debug.drawRigidBody(body);
                    }
                }
            }
            this.debug.drawWorld(this.world);
            this.debug.end();



            // Draw fonts.

            this.graphicsDevice.setTechnique(this.fontTechnique);
            this.fontTechniqueParameters.clipSpace = this.mathDevice.v4Build(2 / this.graphicsDevice.width, -2 / this.graphicsDevice.height, -1, 1, this.fontTechniqueParameters.clipSpace);
            this.graphicsDevice.setTechniqueParameters(this.fontTechniqueParameters);

            var titleHeight = 0.75;
            this.segmentFont(0, 0, "Tree Layout", titleHeight);
            this.segmentFont(3.2, 9, "A", 1.0);
            /*
            segmentFont(10, 0, "Weld", titleHeight);
            segmentFont(20, 0, "Distance", titleHeight);
            segmentFont(30, 0, "Line", titleHeight);
            segmentFont(0, 10, "Angle", titleHeight);
            segmentFont(10, 10, "Motor", titleHeight);
            segmentFont(20, 10, "Pulley", titleHeight);
            segmentFont(30, 10, "Custom", titleHeight);
            this.segmentFont(pos[0], pos[1], node.label, radius);

            */

            this.graphicsDevice.endFrame();
        }


        private loadHtmlControls() {
            var self = this;
            this.htmlControls = HTMLControls.create();
            this.htmlControls.addCheckboxControl({
                id: "elasticConstraints",
                value: "elasticConstraints",
                isSelected: self.elasticConstraints,
                fn: function () {
                    self.elasticConstraints = !self.elasticConstraints;
                    self.invalidateConstraints();
                    return self.elasticConstraints;
                }
            });
            this.htmlControls.addSliderControl({
                id: "frequencySlider",
                value: (self.frequency),
                max: 10,
                min: 0.25,
                step: 0.25,
                fn: function () {
                    self.frequency = this.value;
                    self.htmlControls.updateSlider("frequencySlider", self.frequency);
                    if (self.elasticConstraints) {
                        self.invalidateConstraints();
                    }
                }
            });
            this.htmlControls.addSliderControl({
                id: "dampingSlider",
                value: (self.damping),
                max: 2,
                min: 0,
                step: 0.25,
                fn: function () {
                    self.damping = this.value;
                    self.htmlControls.updateSlider("dampingSlider", self.damping);
                    if (self.elasticConstraints) {
                        self.invalidateConstraints();
                    }
                }
            });
            this.htmlControls.register();
        }


        visStore: Rdfstore.Store;
        visGraph: any;

        
        nodeIdCounter: number; 
        relationIdCounter: number;

        constructor(container: HTMLElement) {
            console.log("Beginning of Stovis Editor constructor... ");

            this.debugEnabled = false;
            this.debugMessagesPerSecond = 1;




            rdfstore.create((vs)=> {
                this.visStore = vs;
                this.visGraph = vs.rdf.createGraph();
                this.nodeMap = {};
                this.relationMap = {};
                this.nodeIdCounter = 0;
                this.relationIdCounter = 0;

                vs.rdf.setPrefix("ex", "http://example.org/people/");
                vs.rdf.setPrefix("foaf", "http://xmlns.com/foaf/0.1/");
                vs.rdf.setPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");

                vs.rdf.setPrefix(STOVIS_PREFIX, STOVIS_IRI);
                           
                console.log("visGraph = ", this.visGraph);
                console.log("visStore = ", this.visStore);

                /**
                graph.add(vs.rdf.createTriple(vs.rdf.createNamedNode(vs.rdf.resolve("ex:Alice")),
                    vs.rdf.createNamedNode(vs.rdf.resolve("foaf:name")),
                    vs.rdf.createLiteral("alice")));
                */

                
                
                /*var triples = graph.match(null, vs.rdf.createNamedNode(vs.rdf.resolve("foaf:name")), null).toArray();

                console.log("triples = ", triples);

                console.log("rdf api worked? " + (triples[0].object.valueOf() === 'alice'));
*/

                // ************       Graphics stuff    *************************


                this.contactsEnabled = false;
                this.framesPerSecond = 60;

                TurbulenzEngine.onload = () => {
                    console.log("sto - Beginning of our redefined TurbulenzEngine.onload");

                    //==========================================================================
                    // HTML Controls
                    //==========================================================================


                    //==========================================================================
                    // Turbulenz Initialization
                    //==========================================================================
                    this.graphicsDevice = TurbulenzEngine.createGraphicsDevice({});
                    console.log("this.graphicsDevice", this.graphicsDevice);
                    this.mathDevice = TurbulenzEngine.createMathDevice({});
                    this.requestHandler = RequestHandler.create({});
                    console.log("RequestHandler = ", this.requestHandler);

                    this.fontManager = FontManager.create(this.graphicsDevice, this.requestHandler);
                    this.shaderManager = ShaderManager.create(this.graphicsDevice, this.requestHandler);


                    var sessionCreated = () => {
                        console.log("Beginning of sessionCreated()");
                        console.log("this.requestHandler", this.requestHandler);
                        console.log("this.gameSession", this.gameSession);

                        TurbulenzServices.createMappingTable(this.requestHandler, this.gameSession, (mappingTable) => {
                            console.log("callback of TurbulenzServices.createMappingTable");
                            var urlMapping = mappingTable.urlMapping;
                            var assetPrefix = mappingTable.assetPrefix;
                            this.shaderManager.setPathRemapping(urlMapping, assetPrefix);
                            this.fontManager.setPathRemapping(urlMapping, assetPrefix);
                            this.fontManager.load('fonts/hero.fnt', (fontObject) => {
                                this.font = fontObject;
                            });
                            this.shaderManager.load('shaders/font.cgfx', (shaderObject) => {
                                this.shader = shaderObject;
                            });
                        });
                    }


                console.log("Creating gameSession");
                    console.log("this.requestHandler = ", this.requestHandler);
                    this.gameSession = TurbulenzServices.createGameSession(this.requestHandler, sessionCreated);

                    //==========================================================================
                    // Physics2D/Draw2D (Use Draw2D to define viewport scalings)
                    //==========================================================================
                    // set up.
                    console.log("Creating phys2D");
                    this.phys2D = Physics2DDevice.create();

                    // size of physics stage.
                    this.stageWidth = 40;
                    this.stageHeight = 20;

                    console.log("Creating draw2D");
                    this.draw2D = Draw2D.create({
                        graphicsDevice: this.graphicsDevice
                    });
                    this.debug = Physics2DDebugDraw.create({
                        graphicsDevice: this.graphicsDevice
                    });

                    // Configure draw2D viewport to the physics stage.
                    // As well as the physics2D debug-draw viewport.
                    this.draw2D.configure({
                        viewportRectangle: [0, 0, this.stageWidth, this.stageHeight],
                        scaleMode: 'scale'
                    });
                    this.debug.setPhysics2DViewport([0, 0, this.stageWidth, this.stageHeight]);

                    this.world = this.phys2D.createWorld({
                        gravity: [0, 0]
                    });

                    // Create a static body at (0, 0) with no rotation
                    // which we add to the world to use as the first body
                    // in hand constraint. We set anchor for this body
                    // as the cursor position in physics coordinates.
                    this.staticReferenceBody = this.phys2D.createRigidBody({
                        type: 'static'
                    });
                    this.world.addRigidBody(this.staticReferenceBody);
                    this.handConstraint = null;

                    this.reset();


                    //==========================================================================
                    // Mouse/Keyboard controls
                    //==========================================================================
                    this.inputDevice = TurbulenzEngine.createInputDevice({});
                    this.keyCodes = this.inputDevice.keyCodes;
                    this.mouseCodes = this.inputDevice.mouseCodes;

                    this.mouseX = 0;
                    this.mouseY = 0;
                    var onMouseOver = (x, y) => {
                        this.mouseX = x;
                        this.mouseY = y;
                    };
                    this.inputDevice.addEventListener('mouseover', onMouseOver);

                    var onKeyUp = (keynum) => {
                        if (keynum === this.keyCodes.R) {
                            this.reset();
                        }
                    };
                    this.inputDevice.addEventListener('keyup', onKeyUp);

                    var onMouseDown = (code, x, y) => {
                        this.mouseX = x;
                        this.mouseY = y;

                        if (this.handConstraint) {
                            return;
                        }

                        var point = this.draw2D.viewportMap(x, y);
                        var body;
                        if (code === this.mouseCodes.BUTTON_0) {
                            var bodies = [];
                            var numBodies = this.world.bodyPointQuery(point, bodies);
                            var i;
                            for (i = 0; i < numBodies; i += 1) {
                                body = bodies[i];
                                if (body.isDynamic()) {
                                    this.handConstraint = this.phys2D.createPointConstraint({
                                        bodyA: this.staticReferenceBody,
                                        bodyB: body,
                                        anchorA: point,
                                        anchorB: body.transformWorldPointToLocal(point),
                                        stiff: false,
                                        maxForce: 1e5
                                    });
                                    this.world.addConstraint(this.handConstraint);
                                }
                            }
                        }
                    };
                    this.inputDevice.addEventListener('mousedown', onMouseDown);

                    var onMouseLeaveUp = () => {
                        if (this.handConstraint) {
                            this.world.removeConstraint(this.handConstraint);
                            this.handConstraint = null;
                        }
                    };
                    this.inputDevice.addEventListener('mouseleave', onMouseLeaveUp);
                    this.inputDevice.addEventListener('mouseup', onMouseLeaveUp);

                    //==========================================================================
                    // Main loop.
                    //==========================================================================
                    this.realTime = 0;
                    this.prevTime = TurbulenzEngine.time;




                    var intervalID = 0;


                    var loadingLoop = () => {
                        if (this.font && this.shader) {
                            this.fontTechnique = this.shader.getTechnique('font');
                            this.fontTechniqueParameters = this.graphicsDevice.createTechniqueParameters({
                                clipSpace: this.mathDevice.v4BuildZero(),
                                alphaRef: 0.01,
                                color: this.mathDevice.v4BuildOne()
                            });

                            TurbulenzEngine.clearInterval(intervalID);
                            intervalID = TurbulenzEngine.setInterval(this.mainLoop.bind(this), 1000 / 60);
                        }
                    }

            intervalID = TurbulenzEngine.setInterval(loadingLoop, 100);

                    //==========================================================================


                    this.loadHtmlControls();

                    // Create a scene destroy callback to run when the window is closed
                    TurbulenzEngine.onunload = () => {
                        if (intervalID) {
                            TurbulenzEngine.clearInterval(intervalID);
                        }

                        if (this.gameSession) {
                            this.gameSession.destroy();
                            this.gameSession = null;
                        }
                    };
                };

                // Engine startup
                //sto window.onload = function () {
                var appEntry = TurbulenzEngine.onload;
                var appShutdown = TurbulenzEngine.onunload;
                if (!appEntry) {
                    window.alert("TurbulenzEngine.onload has not been set");
                    return;
                }

                var canvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('turbulenz_game_engine_canvas');

                var startCanvas = () => {
                    if (canvas.getContext && canvasSupported) {
                        TurbulenzEngine = WebGLTurbulenzEngine.create({
                            canvas: canvas,
                            fillParent: true
                        });

                        if (!TurbulenzEngine) {
                            window.alert("Failed to init TurbulenzEngine (canvas)");
                            return;
                        }

                        TurbulenzEngine.onload = appEntry;
                        TurbulenzEngine.onunload = appShutdown;
                        appEntry();
                    }
                }

            var previousOnBeforeUnload = window.onbeforeunload;
                window.onbeforeunload = function () {
                    if (TurbulenzEngine.onunload) {
                        TurbulenzEngine.onunload.call(this);
                    }
                };  // window.beforeunload

                startCanvas();

            })






            console.log("Done with Editor constructor");
        }
    }


    export function addEditor(container: HTMLElement): Editor {
        return new Editor(container);

    }

}