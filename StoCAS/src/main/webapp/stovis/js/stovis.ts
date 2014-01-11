
/// <reference path="../../stocore/js/libs/jquery/jquery.d.ts" />
/// <reference path="../../stocore/js/stocore.ts" />



/*global TurbulenzEngine: true */
/*global TurbulenzServices: false */
/*global RequestHandler: false */
/*global Physics2DDevice: false */
/*global Draw2D: false */
/*global Draw2DSprite: false */
/*global Physics2DDebugDraw: false */
/*global HTMLControls: false */

/// <reference path="libs/turbulenz-0.27/jslib-modular/turbulenz.d.ts" />
/// <reference path="libs/turbulenz-0.27/jslib-modular/servicedatatypes.d.ts" />
/// <reference path="libs/turbulenz-0.27/jslib-modular/services.d.ts" />
/// <reference path="libs/turbulenz-0.27/jslib-modular/aabbtree.d.ts" />
/// <reference path="libs/turbulenz-0.27/jslib-modular/jsengine_base.d.ts" />
/// <reference path="libs/turbulenz-0.27/jslib-modular/jsengine.d.ts" />
/// <reference path="libs/turbulenz-0.27/jslib-modular/fontmanager.d.ts" />
/// <reference path="libs/turbulenz-0.27/jslib-modular/utilities.d.ts" />

/// <reference path="libs/turbulenz-0.27/jslib-modular/tzdraw2d.d.ts" />
/// <reference path="libs/turbulenz-0.27/jslib-modular/physics2d.d.ts" />
/// <reference path="htmlcontrols.ts" />

// Could not find definition in typescript files
declare var WebGLTurbulenzEngine: any;
// defined in index.html, comes from the demo
declare var canvasSupported: boolean;


// Module
module stovis {

    export var DEFAULT_BACKGROUND_COLOR = "#2e2e2e";
    export var DEFAULT_FILL_COLOR = [1, 1, 1, 1]; // "#ffbaba";
    export var DEFAULT_STROKE_COLOR = "#ff7a7a";
    /** max field size in pixel */
    export var MAX_FIELD_LENGTH = 20000;

    /**
        Experimental - Not using it. Kept here to experiment about ui encapsulation/ web components / whatever 
    */
    class ExperimentalElem {

    }

    export class Node {
        label: string;
        body: Physics2DRigidBody;
        constructor(label: string, body: Physics2DRigidBody) {
            this.label = label;
            this.body = body;
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
        }


        addNode(x: number, y: number, radius: number, text: string, pinned?: boolean) {
            var node = new Node(text, null);
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
            bodyA = this.addNode(3.3, 5, 1, "A");
            bodyB = this.addNode(6.6, 5, 1, "B");

            worldAnchor = [5, 5];
            var pointConstraint = this.phys2D.createPointConstraint({
                bodyA: bodyA,
                bodyB: bodyB,
                anchorA: bodyA.transformWorldPointToLocal(worldAnchor),
                anchorB: bodyB.transformWorldPointToLocal(worldAnchor),
                stiff: (!this.elasticConstraints),
                frequency: this.frequency,
                damping: this.damping
            });
            this.world.addConstraint(pointConstraint);

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

            // ------------------------------------
            // Angle Constraint
            bodyA = this.circle(3, 15, 1.5, true);
            bodyB = this.circle(7, 15, 1.5, true);

            var angleConstraint = this.phys2D.createAngleConstraint({
                bodyA: bodyA,
                bodyB: bodyB,
                ratio: 3,
                lowerBound: -Math.PI * 2,
                upperBound: Math.PI * 2,
                stiff: (!this.elasticConstraints),
                frequency: this.frequency,
                damping: this.damping
            });
            this.world.addConstraint(angleConstraint);

            // ------------------------------------
            // Motor Constraint
            bodyA = this.circle(13, 15, 1.5, true);
            bodyB = this.circle(17, 15, 1.5, true);

            var motorConstraint = this.phys2D.createMotorConstraint({
                bodyA: bodyA,
                bodyB: bodyB,
                ratio: 4,
                rate: 20
            });
            this.world.addConstraint(motorConstraint);

            // ------------------------------------
            // Pulley Constraint
            var bodyC;
            bodyA = this.circle(23.3, 16.6, 0.5);
            bodyB = this.circle(25, 13.3, 1, true);
            bodyC = this.circle(26.6, 16.6, 0.5);

            // Additional distance constraints to prevent pulley
            // becoming degenerate when one side becomes 0 length.
            var distanceA = this.phys2D.createDistanceConstraint({
                bodyA: bodyA,
                bodyB: bodyB,
                lowerBound: 0.25,
                upperBound: Number.POSITIVE_INFINITY,
                anchorA: [0, -0.5],
                anchorB: [-1, 0],
                userData: 'pin'
            });
            this.world.addConstraint(distanceA);

            var distanceB = this.phys2D.createDistanceConstraint({
                bodyA: bodyC,
                bodyB: bodyB,
                lowerBound: 0.25,
                upperBound: Number.POSITIVE_INFINITY,
                anchorA: [0, -0.5],
                anchorB: [1, 0],
                userData: 'pin'
            });
            this.world.addConstraint(distanceB);

            var pulleyConstraint = this.phys2D.createPulleyConstraint({
                bodyA: bodyA,
                bodyB: bodyB,
                bodyC: bodyB,
                bodyD: bodyC,
                anchorA: [0, -0.5],
                anchorB: [-1, 0],
                anchorC: [1, 0],
                anchorD: [0, -0.5],
                ratio: 2,
                lowerBound: 6,
                upperBound: 8,
                stiff: (!this.elasticConstraints),
                frequency: this.frequency,
                damping: this.damping
            });
            this.world.addConstraint(pulleyConstraint);

            // ------------------------------------
            // Custom Constraint
            bodyA = this.circle(35, 13.3, 1);
            bodyB = this.circle(35, 16.6, 1, true);

            // Additional line constraint to pin upper body to rack.
            var line = this.phys2D.createLineConstraint({
                bodyA: this.staticReferenceBody,
                bodyB: bodyA,
                anchorA: [35, 13.3],
                anchorB: [0, 0],
                axis: [1, 0],
                lowerBound: -5,
                upperBound: 5,
                userData: 'pin'
            });
            this.world.addConstraint(line);

            // Custom constraint defined so that the x-position of
            // the first body, is equal to the rotation of the
            // second body.
            //
            // Constraint equation:
            //    (pi / 5) * (bodyA.posX - 35) - bodyB.rotation = 0
            //
            // Time Derivative (Velocity constraint):
            //    (pi / 5) * bodyA.velX - bodyB.angularVel = 0
            //
            // Partial derivatives of velocity constraint (Jacobian)
            //        velAx   velAy  angVelA  velBx  velBy  angVelB
            //    [ (pi / 5),   0,      0,      0,     0,     -1    ]
            //
            var user = this.phys2D.createCustomConstraint({
                bodies: [bodyA, bodyB],
                dimension: 1,
                position: function positionFn(data, index) {
                    var bodyA = this.bodies[0];
                    var bodyB = this.bodies[1];
                    data[index] = (Math.PI / 5 * (bodyA.getPosition()[0] - 35)) - bodyB.getRotation();
                },
                jacobian: function jacobianFn(data, index) {
                    data[index] = (Math.PI / 5);
                    data[index + 1] = 0;
                    data[index + 2] = 0;

                    data[index + 3] = 0;
                    data[index + 4] = 0;
                    data[index + 5] = -1;
                },
                debugDraw: function debugDrawFn(debug, stiff) {
                    if (stiff) {
                        return;
                    }

                    var bodyA = this.bodies[0];
                    var bodyB = this.bodies[1];

                    var posA = bodyA.getPosition();
                    var posB = bodyB.getPosition();

                    // target for x-position of bodyA
                    var targetX = ((bodyB.getRotation()) / (Math.PI / 5)) + 35;

                    // target for rotation of bodyB
                    var targetR = (Math.PI / 5 * (posA[0] - 35));

                    // 3 pixel spring radius
                    var radius = 3 * debug.screenToPhysics2D;
                    debug.drawLinearSpring(posA[0], posA[1], targetX, posA[1], 3, radius, [1, 0, 0, 1]);
                    debug.drawSpiralSpring(posB[0], posB[1], targetR, bodyB.getRotation(), radius, radius * 2, [0, 0, 1, 1]);
                },
                stiff: (!this.elasticConstraints),
                frequency: this.frequency,
                damping: this.damping
            });
            this.world.addConstraint(user);
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

        drawNode(node: Node) {
            // console.log("Drawing node", node);
            var pos = node.body.getPosition();
            var circle = node.body.shapes[0];
            // assuming a circle body - these constants are awful! Don't they have a CircleShape class??           
            var data = circle._data;
            var radius = data[(/*CIRCLE_RADIUS*/6)];

            this.debug.drawRigidBody(node.body);
            if (this.world.timeStamp % (Math.floor(this.framesPerSecond / this.debugMessagesPerSecond)) === 0) {
                console.log("pos[0] : ", pos[0], "pos[1] : ", pos[1], "radius : ", radius);
            }


            this.drawCenteredText(pos[0], pos[1], node.label, radius, radius);
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

        constructor(container: HTMLElement) {
            console.log("Beginning of Editor constructor... ");

            this.debugEnabled = false;
            this.debugMessagesPerSecond = 1;




            rdfstore.create((store)=> {
                this.visStore = store;

                store.rdf.setPrefix("ex", "http://example.org/people/");
                store.rdf.setPrefix("foaf", "http://xmlns.com/foaf/0.1/");

                var graph = store.rdf.createGraph();

                graph.add(store.rdf.createTriple(store.rdf.createNamedNode(store.rdf.resolve("ex:Alice")),
                    store.rdf.createNamedNode(store.rdf.resolve("foaf:name")),
                    store.rdf.createLiteral("alice")));

                console.log("graph = ", graph);

                var triples = graph.match(null, store.rdf.createNamedNode(store.rdf.resolve("foaf:name")), null).toArray();

                console.log("triples = ", triples);

                console.log("rdf api worked? " + (triples[0].object.valueOf() === 'alice'));

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
                        gravity: [0, 20]
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

