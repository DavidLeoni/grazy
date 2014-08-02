/// <reference path="../../../stolang/js/com.jquery/jquery.d.ts" />
/// <reference path="../../../stolang/ts/org.stocas.lang/stolang.ts" />
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


// Module
var stovis;
(function (stovis) {
    stovis.STOVIS_PREFIX = "stovis";
    stovis.STOVIS_IRI = "https://github.com/davidleoni/stovis";
    stovis.DEFAULT_BACKGROUND_COLOR = "#2e2e2e";
    stovis.DEFAULT_FILL_COLOR = [1, 1, 1, 1];
    stovis.DEFAULT_STROKE_COLOR = "#ff7a7a";
    stovis.DEFAULT_RADIUS = 1.0;

    /** max field size in pixel */
    stovis.MAX_FIELD_LENGTH = 20000;

    /**
    Experimental - Not using it. Kept here to experiment about ui encapsulation/ web components / whatever
    */
    var ExperimentalElem = (function () {
        function ExperimentalElem() {
        }
        return ExperimentalElem;
    })();

    var JsonLd = (function () {
        function JsonLd() {
        }
        return JsonLd;
    })();
    stovis.JsonLd = JsonLd;

    var VisNode = (function () {
        function VisNode(id, rdfNode, body) {
            this.id = id;
            this.rdfNode = rdfNode;
            this.body = body;
            this.pin = null;
        }
        Object.defineProperty(VisNode.prototype, "radius", {
            get: function () {
                var circle = this.body.shapes[0];

                // assuming a circle body - these constants are awful! Don't they have a CircleShape class??
                var data = circle._data;
                return data[(/*CIRCLE_RADIUS*/ 6)];
            },
            enumerable: true,
            configurable: true
        });
        return VisNode;
    })();
    stovis.VisNode = VisNode;

    var Relation = (function () {
        function Relation(id, nodeA, nodeB, constraint, relationUrl) {
            this.id = id;
            this.nodeA = nodeA;
            this.nodeB = nodeB;
            this.constraint = constraint;
            this.relationUrl = relationUrl;
        }
        return Relation;
    })();
    stovis.Relation = Relation;

    var Editor = (function () {
        function Editor(container) {
            var _this = this;
            this.elasticConstraints = false;
            this.frequency = 1;
            this.damping = 0.1;
            this.thickness = 0.01;
            console.log("Beginning of Stovis Editor constructor... ");

            this.debugEnabled = false;
            this.debugMessagesPerSecond = 1;

            rdfstore.create(function (vs) {
                _this.visStore = vs;
                _this.visGraph = vs.rdf.createGraph();
                _this.nodeMap = {};
                _this.relationMap = {};
                _this.nodeIdCounter = 0;
                _this.relationIdCounter = 0;

                vs.rdf.setPrefix("ex", "http://example.org/people/");
                vs.rdf.setPrefix("foaf", "http://xmlns.com/foaf/0.1/");
                vs.rdf.setPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");

                vs.rdf.setPrefix(stovis.STOVIS_PREFIX, stovis.STOVIS_IRI);

                console.log("visGraph = ", _this.visGraph);
                console.log("visStore = ", _this.visStore);

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
                _this.contactsEnabled = false;
                _this.framesPerSecond = 60;

                TurbulenzEngine.onload = function () {
                    console.log("sto - Beginning of our redefined TurbulenzEngine.onload");

                    //==========================================================================
                    // HTML Controls
                    //==========================================================================
                    //==========================================================================
                    // Turbulenz Initialization
                    //==========================================================================
                    _this.graphicsDevice = TurbulenzEngine.createGraphicsDevice({});
                    console.log("this.graphicsDevice", _this.graphicsDevice);
                    _this.mathDevice = TurbulenzEngine.createMathDevice({});
                    _this.requestHandler = RequestHandler.create({});
                    console.log("RequestHandler = ", _this.requestHandler);

                    _this.fontManager = FontManager.create(_this.graphicsDevice, _this.requestHandler);
                    _this.shaderManager = ShaderManager.create(_this.graphicsDevice, _this.requestHandler);

                    var sessionCreated = function () {
                        console.log("Beginning of sessionCreated()");
                        console.log("this.requestHandler", _this.requestHandler);
                        console.log("this.gameSession", _this.gameSession);

                        TurbulenzServices.createMappingTable(_this.requestHandler, _this.gameSession, function (mappingTable) {
                            console.log("callback of TurbulenzServices.createMappingTable");
                            var urlMapping = mappingTable.urlMapping;
                            var assetPrefix = mappingTable.assetPrefix;
                            _this.shaderManager.setPathRemapping(urlMapping, assetPrefix);
                            _this.fontManager.setPathRemapping(urlMapping, assetPrefix);
                            _this.fontManager.load('fonts/hero.fnt', function (fontObject) {
                                _this.font = fontObject;
                            });
                            _this.shaderManager.load('shaders/font.cgfx', function (shaderObject) {
                                _this.shader = shaderObject;
                            });
                        });
                    };

                    console.log("Creating gameSession");
                    console.log("this.requestHandler = ", _this.requestHandler);
                    _this.gameSession = TurbulenzServices.createGameSession(_this.requestHandler, sessionCreated);

                    //==========================================================================
                    // Physics2D/Draw2D (Use Draw2D to define viewport scalings)
                    //==========================================================================
                    // set up.
                    console.log("Creating phys2D");
                    _this.phys2D = Physics2DDevice.create();

                    // size of physics stage.
                    _this.stageWidth = 40;
                    _this.stageHeight = 20;

                    console.log("Creating draw2D");
                    _this.draw2D = Draw2D.create({
                        graphicsDevice: _this.graphicsDevice
                    });
                    _this.debug = Physics2DDebugDraw.create({
                        graphicsDevice: _this.graphicsDevice
                    });

                    // Configure draw2D viewport to the physics stage.
                    // As well as the physics2D debug-draw viewport.
                    _this.draw2D.configure({
                        viewportRectangle: [0, 0, _this.stageWidth, _this.stageHeight],
                        scaleMode: 'scale'
                    });
                    _this.debug.setPhysics2DViewport([0, 0, _this.stageWidth, _this.stageHeight]);

                    _this.world = _this.phys2D.createWorld({
                        gravity: [0, 0]
                    });

                    // Create a static body at (0, 0) with no rotation
                    // which we add to the world to use as the first body
                    // in hand constraint. We set anchor for this body
                    // as the cursor position in physics coordinates.
                    _this.staticReferenceBody = _this.phys2D.createRigidBody({
                        type: 'static'
                    });
                    _this.world.addRigidBody(_this.staticReferenceBody);
                    _this.handConstraint = null;

                    _this.reset();

                    //==========================================================================
                    // Mouse/Keyboard controls
                    //==========================================================================
                    _this.inputDevice = TurbulenzEngine.createInputDevice({});
                    _this.keyCodes = _this.inputDevice.keyCodes;
                    _this.mouseCodes = _this.inputDevice.mouseCodes;

                    _this.mouseX = 0;
                    _this.mouseY = 0;
                    var onMouseOver = function (x, y) {
                        _this.mouseX = x;
                        _this.mouseY = y;
                    };
                    _this.inputDevice.addEventListener('mouseover', onMouseOver);

                    var onKeyUp = function (keynum) {
                        if (keynum === _this.keyCodes.R) {
                            _this.reset();
                        }
                    };
                    _this.inputDevice.addEventListener('keyup', onKeyUp);

                    var onMouseDown = function (code, x, y) {
                        _this.mouseX = x;
                        _this.mouseY = y;

                        if (_this.handConstraint) {
                            return;
                        }

                        var point = _this.draw2D.viewportMap(x, y);
                        var body;
                        if (code === _this.mouseCodes.BUTTON_0) {
                            var bodies = [];
                            var numBodies = _this.world.bodyPointQuery(point, bodies);
                            var i;
                            for (i = 0; i < numBodies; i += 1) {
                                body = bodies[i];
                                if (body.isDynamic()) {
                                    _this.handConstraint = _this.phys2D.createPointConstraint({
                                        bodyA: _this.staticReferenceBody,
                                        bodyB: body,
                                        anchorA: point,
                                        anchorB: body.transformWorldPointToLocal(point),
                                        stiff: false,
                                        maxForce: 1e5
                                    });
                                    _this.world.addConstraint(_this.handConstraint);
                                }
                            }
                        }
                    };
                    _this.inputDevice.addEventListener('mousedown', onMouseDown);

                    var onMouseLeaveUp = function () {
                        if (_this.handConstraint) {
                            _this.world.removeConstraint(_this.handConstraint);
                            _this.handConstraint = null;
                        }
                    };
                    _this.inputDevice.addEventListener('mouseleave', onMouseLeaveUp);
                    _this.inputDevice.addEventListener('mouseup', onMouseLeaveUp);

                    //==========================================================================
                    // Main loop.
                    //==========================================================================
                    _this.realTime = 0;
                    _this.prevTime = TurbulenzEngine.time;

                    var intervalID = 0;

                    var loadingLoop = function () {
                        if (_this.font && _this.shader) {
                            _this.fontTechnique = _this.shader.getTechnique('font');
                            _this.fontTechniqueParameters = _this.graphicsDevice.createTechniqueParameters({
                                clipSpace: _this.mathDevice.v4BuildZero(),
                                alphaRef: 0.01,
                                color: _this.mathDevice.v4BuildOne()
                            });

                            TurbulenzEngine.clearInterval(intervalID);
                            intervalID = TurbulenzEngine.setInterval(_this.mainLoop.bind(_this), 1000 / 60);
                        }
                    };

                    intervalID = TurbulenzEngine.setInterval(loadingLoop, 100);

                    //==========================================================================
                    _this.loadHtmlControls();

                    // Create a scene destroy callback to run when the window is closed
                    TurbulenzEngine.onunload = function () {
                        if (intervalID) {
                            TurbulenzEngine.clearInterval(intervalID);
                        }

                        if (_this.gameSession) {
                            _this.gameSession.destroy();
                            _this.gameSession = null;
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

                var canvas = document.getElementById('turbulenz_game_engine_canvas');

                var startCanvas = function () {
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
                };

                var previousOnBeforeUnload = window.onbeforeunload;
                window.onbeforeunload = function () {
                    if (TurbulenzEngine.onunload) {
                        TurbulenzEngine.onunload.call(this);
                    }
                }; // window.beforeunload

                startCanvas();
            });

            console.log("Done with Editor constructor");
        }
        Editor.prototype.addNodeNearCenter = function (label) {
            throw new Error("Implement me!");
        };

        Editor.prototype.unpinNode = function (node) {
            if (node.pin) {
                this.world.removeConstraint(node.pin);
            }
        };

        Editor.prototype.pinNode = function (node) {
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
        };

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
        Editor.prototype.addRelation = function (nodeA, predicateUrl, nodeB) {
            this.visStore.execute('INSERT DATA {  <' + nodeA.rdfNode.nominalValue + '> <' + predicateUrl + '> <' + nodeB.rdfNode.nominalValue + '> }');

            var bodyA = nodeA.body;
            var bodyB = nodeB.body;

            var loBound = nodeA.radius + nodeB.radius + 2.0 * stovis.DEFAULT_RADIUS;
            var upBound = loBound + 2.0 * stovis.DEFAULT_RADIUS;

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
        };

        Editor.prototype.addNode = function (x, y, radius, iri) {
            var vs = this.visStore;
            var rdfNode = vs.rdf.createNamedNode(iri);

            var node = new VisNode(null, rdfNode, null);

            vs.execute('INSERT DATA {  <' + iri + '> <rdfs:label> "' + vs.rdf.terms.shrink(iri) + '" }');

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
        };

        Editor.prototype.circle = function (x, y, radius, pinned) {
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
        };

        Editor.prototype.reset = function () {
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
            var nodeC = this.addNode(2, 2, stovis.DEFAULT_RADIUS, "C");
            var nodeD = this.addNode(8, 2, stovis.DEFAULT_RADIUS, "D");

            var nodeA = this.addNode(3.3, 5, stovis.DEFAULT_RADIUS, "A");
            var nodeB = this.addNode(6.6, 5, stovis.DEFAULT_RADIUS, "B");

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
        };

        Editor.prototype.invalidateConstraints = function () {
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
        };

        Editor.prototype.segmentFont = function (x, y, text, height) {
            var topLeft = this.draw2D.viewportUnmap(x, y);
            var bottomRight = this.draw2D.viewportUnmap(x + 10, y + height);
            this.font.drawTextRect(text, {
                rect: [topLeft[0], topLeft[1], bottomRight[0] - topLeft[0], bottomRight[1] - topLeft[1]],
                scale: 1.0,
                spacing: 0,
                alignment: 1
            });
        };

        /**
        x and y are the upper left corner of the text. i.e. 0,0 for upper left corner of the screen
        width, height: i.e. 10,10 for a box like in physics 2d contraints example.
        Currently they don't even work, in theory they are needed to define the maximum allowed region where to draw
        Semms like a font has width and height of 1.0, when scaling factor is 1.0
        todo should determine scale / linebreaks accordingly.
        todo - is this the right place to set fontTechnique? guess not.
        */
        Editor.prototype.drawCenteredText = function (x, y, text, width, height) {
            // Notice long text will exceed width.Height is not even taken into account by Turbulenz
            /** fonts won't exceed this width */
            var fontWidth = 1.0;

            /** fonts won't exceed this height */
            var fontHeight = 1.0;
            var fontSpacing = 0.0;
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
                alignment: 1
            });
        };

        Editor.prototype.drawNode = function (node) {
            // console.log("Drawing node", node);
            var pos = node.body.getPosition();
            var circle = node.body.shapes[0];

            // assuming a circle body - these constants are awful! Don't they have a CircleShape class??
            var data = circle._data;
            var radius = data[(/*CIRCLE_RADIUS*/ 6)];

            this.debug.drawRigidBody(node.body);
            if (this.world.timeStamp % (Math.floor(this.framesPerSecond / this.debugMessagesPerSecond)) === 0) {
                //console.log("pos[0] : ", pos[0], "pos[1] : ", pos[1], "radius : ", radius);
            }

            this.drawCenteredText(pos[0], pos[1], node.rdfNode.nominalValue, radius, radius);
        };

        Editor.prototype.mainLoop = function () {
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
        };

        Editor.prototype.loadHtmlControls = function () {
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
        };
        Editor.labels = ["L", "[]", "head", "tail"];
        return Editor;
    })();
    stovis.Editor = Editor;

    function addEditor(container) {
        return new Editor(container);
    }
    stovis.addEditor = addEditor;
})(stovis || (stovis = {}));
//# sourceMappingURL=stovis.js.map
