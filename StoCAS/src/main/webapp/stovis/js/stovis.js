// Module
var stovis;
(function (stovis) {
    stovis.DEFAULT_BACKGROUND_COLOR = "#2e2e2e";
    stovis.DEFAULT_FILL_COLOR = "#ffbaba";
    stovis.DEFAULT_STROKE_COLOR = "#ff7a7a";

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

    var Editor = (function () {
        function Editor(container) {
            console.log("Beginning of Editor constructor... ");

            var canvasSupported = true;
            ((function () {
                var contextNames = ["webgl", "experimental-webgl"];
                var context = null;
                var canvas = document.createElement('canvas');

                document.body.appendChild(canvas);

                for (var i = 0; i < contextNames.length; i += 1) {
                    try  {
                        context = canvas.getContext(contextNames[i]);
                    } catch (e) {
                    }

                    if (context) {
                        break;
                    }
                }
                if (!context) {
                    canvasSupported = false;
                    window.alert("Sorry, but your browser does not support WebGL or does not have it enabled.");
                }

                document.body.removeChild(canvas);
            })());

            TurbulenzEngine.onload = function onloadFn() {
                //==========================================================================
                // HTML Controls
                //==========================================================================
                var htmlControls;

                var debugEnabled = false;
                var contactsEnabled = false;

                //==========================================================================
                // Turbulenz Initialization
                //==========================================================================
                var graphicsDevice = TurbulenzEngine.createGraphicsDevice({});
                var mathDevice = TurbulenzEngine.createMathDevice({});
                var requestHandler = RequestHandler.create({});

                var draw2DTexture;
                var gameSession;
                function sessionCreated(gameSession) {
                    TurbulenzServices.createMappingTable(requestHandler, gameSession, function (table) {
                        graphicsDevice.createTexture({
                            src: table.getURL("textures/physics2d.png"),
                            mipmaps: true,
                            onload: function (texture) {
                                if (texture) {
                                    draw2DTexture = texture;
                                }
                            }
                        });
                    });
                }
                gameSession = TurbulenzServices.createGameSession(requestHandler, sessionCreated);

                //==========================================================================
                // Physics2D/Draw2D
                //==========================================================================
                // set up.
                var phys2D = Physics2DDevice.create();

                // size of physics stage.
                var stageWidth = 30;
                var stageHeight = 22;

                var draw2D = Draw2D.create({
                    graphicsDevice: graphicsDevice
                });
                var debug = Physics2DDebugDraw.create({
                    graphicsDevice: graphicsDevice
                });

                // Configure draw2D viewport to the physics stage.
                // As well as the physics2D debug-draw viewport.
                draw2D.configure({
                    viewportRectangle: [0, 0, stageWidth, stageHeight],
                    scaleMode: 'scale'
                });
                debug.setPhysics2DViewport([0, 0, stageWidth, stageHeight]);

                var world = phys2D.createWorld({
                    gravity: [0, 20]
                });

                var rubberMaterial = phys2D.createMaterial({
                    elasticity: 0.9,
                    staticFriction: 6,
                    dynamicFriction: 4,
                    rollingFriction: 0.001
                });

                var heavyMaterial = phys2D.createMaterial({
                    density: 3
                });

                var conveyorBeltMaterial = phys2D.createMaterial({
                    elasticity: 0,
                    staticFriction: 10,
                    dynamicFriction: 8,
                    rollingFriction: 0.1
                });

                var shapeSize = 0.8;
                var shapeFactory = [
                    phys2D.createCircleShape({
                        radius: (shapeSize / 2),
                        material: rubberMaterial
                    }),
                    phys2D.createPolygonShape({
                        vertices: phys2D.createBoxVertices(shapeSize, shapeSize),
                        material: heavyMaterial
                    }),
                    phys2D.createPolygonShape({
                        vertices: phys2D.createRegularPolygonVertices(shapeSize, shapeSize, 3),
                        material: heavyMaterial
                    }),
                    phys2D.createPolygonShape({
                        vertices: phys2D.createRegularPolygonVertices(shapeSize, shapeSize, 6),
                        material: rubberMaterial
                    })
                ];

                // texture rectangles for above shapes.
                var textureRectangles = [
                    [130, 130, 255, 255],
                    [5, 132, 125, 252],
                    [131, 3, 251, 123],
                    [5, 5, 125, 125]
                ];

                // Create a static body at (0, 0) with no rotation
                // which we add to the world to use as the first body
                // in hand constraint. We set anchor for this body
                // as the cursor position in physics coordinates.
                var handReferenceBody = phys2D.createRigidBody({
                    type: 'static'
                });
                world.addRigidBody(handReferenceBody);
                var handConstraint = null;

                var animationState = 0;
                var lift;
                var pusher;

                function reset() {
                    // Remove all bodies and constraints from world.
                    world.clear();
                    handConstraint = null;

                    // Create a static border body around the stage to stop objects leaving the viewport.
                    var thickness = 0.01;
                    var border = phys2D.createRigidBody({
                        type: 'static',
                        shapes: [
                            phys2D.createPolygonShape({
                                vertices: phys2D.createRectangleVertices(0, 0, thickness, stageHeight)
                            }),
                            phys2D.createPolygonShape({
                                vertices: phys2D.createRectangleVertices(0, 0, stageWidth, thickness)
                            }),
                            phys2D.createPolygonShape({
                                vertices: phys2D.createRectangleVertices((stageWidth - thickness), 0, stageWidth, stageHeight)
                            }),
                            phys2D.createPolygonShape({
                                vertices: phys2D.createRectangleVertices(0, (stageHeight - thickness), stageWidth, stageHeight)
                            })
                        ]
                    });
                    world.addRigidBody(border);

                    var createBelt = function createBeltFn(x1, y1, x2, y2, radius, speed) {
                        var normal = mathDevice.v2Build(y2 - y1, x1 - x2);
                        mathDevice.v2ScalarMul(normal, radius / mathDevice.v2Length(normal), normal);

                        var shapes = [
                            phys2D.createPolygonShape({
                                vertices: [
                                    [x1 + normal[0], y1 + normal[1]],
                                    [x2 + normal[0], y2 + normal[1]],
                                    [x2 - normal[0], y2 - normal[1]],
                                    [x1 - normal[0], y1 - normal[1]]
                                ],
                                material: conveyorBeltMaterial
                            }),
                            phys2D.createCircleShape({
                                radius: radius,
                                origin: [x1, y1],
                                material: conveyorBeltMaterial
                            }),
                            phys2D.createCircleShape({
                                radius: radius,
                                origin: [x2, y2],
                                material: conveyorBeltMaterial
                            })
                        ];
                        var body = phys2D.createRigidBody({
                            type: 'static',
                            surfaceVelocity: [speed, 0],
                            shapes: shapes
                        });

                        return body;
                    };

                    var belt;
                    belt = createBelt(0, 11, 7, 14, 0.5, 2);
                    world.addRigidBody(belt);

                    belt = createBelt(7, 14, 14, 11, 0.5, 2);
                    world.addRigidBody(belt);

                    belt = createBelt(12, 19, 20.5, 17, 0.5, 2);
                    world.addRigidBody(belt);

                    belt = createBelt(20.5, 10.5, 10, 5, 0.5, -2);
                    world.addRigidBody(belt);

                    belt = createBelt(10, 5, 5, 5, 0.5, -2);
                    world.addRigidBody(belt);

                    // Create lift and pusher bodies.
                    lift = phys2D.createRigidBody({
                        shapes: [
                            phys2D.createPolygonShape({
                                vertices: phys2D.createBoxVertices(9, 0.01)
                            })
                        ],
                        type: 'kinematic',
                        position: [stageWidth - 4.5, stageHeight]
                    });
                    pusher = phys2D.createRigidBody({
                        shapes: [
                            phys2D.createPolygonShape({
                                vertices: phys2D.createBoxVertices(9, 10)
                            })
                        ],
                        type: 'kinematic',
                        position: [stageWidth + 4.5, 5]
                    });
                    world.addRigidBody(lift);
                    world.addRigidBody(pusher);
                    animationState = 0;

                    // Create piles of each factory shape.
                    var x, y;
                    var xCount = Math.floor(stageWidth / shapeSize);
                    for (x = 0; x < xCount; x += 1) {
                        for (y = 0; y < 4; y += 1) {
                            var index = (y % shapeFactory.length);
                            var shape = shapeFactory[index];
                            var body = phys2D.createRigidBody({
                                shapes: [shape.clone()],
                                position: [
                                    (x + 0.5) * (stageWidth / xCount),
                                    (y + 0.5) * shapeSize
                                ],
                                userData: Draw2DSprite.create({
                                    width: shapeSize,
                                    height: shapeSize,
                                    origin: [shapeSize / 2, shapeSize / 2],
                                    textureRectangle: textureRectangles[index],
                                    texture: draw2DTexture
                                })
                            });
                            world.addRigidBody(body);
                        }
                    }
                }

                //==========================================================================
                // Mouse/Keyboard controls
                //==========================================================================
                var inputDevice = TurbulenzEngine.createInputDevice({});
                var keyCodes = inputDevice.keyCodes;
                var mouseCodes = inputDevice.mouseCodes;

                var mouseX = 0;
                var mouseY = 0;
                var onMouseOver = function mouseOverFn(x, y) {
                    mouseX = x;
                    mouseY = y;
                };
                inputDevice.addEventListener('mouseover', onMouseOver);

                var onKeyUp = function onKeyUpFn(keynum) {
                    if (keynum === keyCodes.R) {
                        reset();
                    }
                };
                inputDevice.addEventListener('keyup', onKeyUp);

                var onMouseDown = function onMouseDownFn(code, x, y) {
                    mouseX = x;
                    mouseY = y;

                    if (handConstraint) {
                        return;
                    }

                    var point = draw2D.viewportMap(x, y);
                    var body;
                    if (code === mouseCodes.BUTTON_0) {
                        var bodies = [];
                        var numBodies = world.bodyPointQuery(point, bodies);
                        var i;
                        for (i = 0; i < numBodies; i += 1) {
                            body = bodies[i];
                            if (body.isDynamic()) {
                                handConstraint = phys2D.createPointConstraint({
                                    bodyA: handReferenceBody,
                                    bodyB: body,
                                    anchorA: point,
                                    anchorB: body.transformWorldPointToLocal(point),
                                    stiff: false,
                                    maxForce: 1e5
                                });
                                world.addConstraint(handConstraint);
                                break;
                            }
                        }
                    } else if (code === mouseCodes.BUTTON_1) {
                        var index = Math.floor(Math.random() * shapeFactory.length);
                        body = phys2D.createRigidBody({
                            shapes: [shapeFactory[index].clone()],
                            position: point,
                            userData: Draw2DSprite.create({
                                width: shapeSize,
                                height: shapeSize,
                                origin: [shapeSize / 2, shapeSize / 2],
                                textureRectangle: textureRectangles[index],
                                texture: draw2DTexture
                            })
                        });
                        world.addRigidBody(body);
                    }
                };
                inputDevice.addEventListener('mousedown', onMouseDown);

                var onMouseLeaveUp = function onMouseLeaveUpFn() {
                    if (handConstraint) {
                        world.removeConstraint(handConstraint);
                        handConstraint = null;
                    }
                };
                inputDevice.addEventListener('mouseleave', onMouseLeaveUp);
                inputDevice.addEventListener('mouseup', onMouseLeaveUp);

                //==========================================================================
                // Main loop.
                //==========================================================================
                var fpsElement = document.getElementById("fpscounter");
                var lastFPS = "";

                var bodiesElement = document.getElementById("bodiescounter");
                var lastNumBodies = 0;

                var realTime = 0;
                var prevTime = TurbulenzEngine.time;

                function mainLoop() {
                    if (!graphicsDevice.beginFrame()) {
                        return;
                    }

                    inputDevice.update();
                    graphicsDevice.clear([0.3, 0.3, 0.3, 1.0]);

                    var body;
                    if (handConstraint) {
                        body = handConstraint.bodyB;
                        handConstraint.setAnchorA(draw2D.viewportMap(mouseX, mouseY));

                        // Additional angular dampening of body being dragged.
                        // Helps it to settle quicker instead of spinning around
                        // the cursor.
                        body.setAngularVelocity(body.getAngularVelocity() * 0.9);
                    }

                    var curTime = TurbulenzEngine.time;
                    var timeDelta = (curTime - prevTime);

                    if (timeDelta > (1 / 20)) {
                        timeDelta = (1 / 20);
                    }
                    realTime += timeDelta;
                    prevTime = curTime;

                    while (world.simulatedTime < realTime) {
                        if (animationState === 0) {
                            // Start of animatino, set velocity of lift to move up to the target
                            // in 3 seconds.
                            lift.setVelocityFromPosition([stageWidth - 4.5, 10], 0, 3);
                            animationState = 1;
                        } else if (animationState === 1) {
                            if (lift.getPosition()[1] <= 10) {
                                // Reached target position for lift.
                                // Set position incase it over-reached and zero velocity.
                                lift.setPosition([stageWidth - 4.5, 10]);
                                lift.setVelocity([0, 0]);

                                // Start pusher animation to move left.
                                pusher.setVelocityFromPosition([stageWidth - 4.5, 5], 0, 1.5);
                                animationState = 2;
                            }
                        } else if (animationState === 2) {
                            if (pusher.getPosition()[0] <= (stageWidth - 4.5)) {
                                // Reached target position for pusher.
                                // Set velocities of pusher and lift to both move right off-screen.
                                pusher.setVelocityFromPosition([stageWidth + 4.5, 5], 0, 1);
                                lift.setVelocityFromPosition([stageWidth + 4.5, 10], 0, 1);
                                animationState = 3;
                            }
                        } else if (animationState === 3) {
                            if (pusher.getPosition()[0] >= stageWidth + 4.5) {
                                // Reached target.
                                // Reset positions and velocities and begin animation afresh.
                                pusher.setPosition([stageWidth + 4.5, 5]);
                                pusher.setVelocity([0, 0]);
                                lift.setPosition([stageWidth - 4.5, stageHeight]);
                                lift.setVelocity([0, 0]);
                                animationState = 0;
                            }
                        }

                        world.step(1 / 60);
                    }

                    // draw2D sprite drawing.
                    var bodies = world.rigidBodies;
                    var limit = bodies.length;
                    var i;
                    if (!debugEnabled) {
                        draw2D.begin('alpha', 'deferred');
                        var pos = [];
                        for (i = 0; i < limit; i += 1) {
                            body = bodies[i];
                            if (body.userData) {
                                body.getPosition(pos);
                                var sprite = body.userData;
                                sprite.x = pos[0];
                                sprite.y = pos[1];
                                sprite.rotation = body.getRotation();
                                draw2D.drawSprite(sprite);
                            }
                        }
                        draw2D.end();
                    }

                    // physics2D debug drawing.
                    debug.setScreenViewport(draw2D.getScreenSpaceViewport());
                    debug.showRigidBodies = debugEnabled;
                    debug.showContacts = contactsEnabled;

                    debug.begin();
                    if (!debugEnabled) {
                        for (i = 0; i < limit; i += 1) {
                            body = bodies[i];
                            if (!body.userData) {
                                debug.drawRigidBody(body);
                            }
                        }
                    }
                    debug.drawWorld(world);
                    debug.end();

                    graphicsDevice.endFrame();

                    if (fpsElement) {
                        var fpsText = (graphicsDevice.fps).toFixed(2);
                        if (lastFPS !== fpsText) {
                            lastFPS = fpsText;

                            fpsElement.innerHTML = fpsText + " fps";
                        }
                    }

                    if (bodiesElement) {
                        if (lastNumBodies !== limit) {
                            lastNumBodies = limit;

                            bodiesElement.innerHTML = lastNumBodies + "";
                        }
                    }
                }

                var intervalID;
                function loadingLoop() {
                    if (!draw2DTexture) {
                        return;
                    }

                    reset();
                    TurbulenzEngine.clearInterval(intervalID);
                    intervalID = TurbulenzEngine.setInterval(mainLoop, 1000 / 60);
                }
                intervalID = TurbulenzEngine.setInterval(loadingLoop, 10);

                //==========================================================================
                function loadHtmlControls() {
                    htmlControls = HTMLControls.create();
                    htmlControls.addCheckboxControl({
                        id: "enableDebug",
                        value: "debugEnabled",
                        isSelected: debugEnabled,
                        fn: function () {
                            debugEnabled = !debugEnabled;
                            return debugEnabled;
                        }
                    });
                    htmlControls.addCheckboxControl({
                        id: "enableContacts",
                        value: "contactsEnabled",
                        isSelected: contactsEnabled,
                        fn: function () {
                            contactsEnabled = !contactsEnabled;
                            return contactsEnabled;
                        }
                    });
                    htmlControls.register();
                }

                loadHtmlControls();

                // Create a scene destroy callback to run when the window is closed
                TurbulenzEngine.onunload = function destroyScene() {
                    if (intervalID) {
                        TurbulenzEngine.clearInterval(intervalID);
                    }

                    if (gameSession) {
                        gameSession.destroy();
                        gameSession = null;
                    }
                };
            };

            var appEntry = TurbulenzEngine.onload;
            var appShutdown = TurbulenzEngine.onunload;
            if (!appEntry) {
                window.alert("TurbulenzEngine.onload has not been set");
                return;
            }

            var canvas = document.getElementById('turbulenz_game_engine_canvas');

            var startCanvas = function startCanvasFn() {
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

                    // appEntry() sto put TurbulenzEngine inside
                    appEntry(TurbulenzEngine);
                }
            };

            var previousOnBeforeUnload = window.onbeforeunload;
            window.onbeforeunload = function () {
                if (TurbulenzEngine.onunload) {
                    TurbulenzEngine.onunload.call(this);
                }
            };

            startCanvas();

            console.log("Done with Editor constructor");
        }
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
