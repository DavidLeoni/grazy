/// <reference path="libs/d3/d3.d.ts" />
/// <reference path="../../stocore/js/stocore.ts" />
// Module
var stovis;
(function (stovis) {
    stovis.DEFAULT_BACKGROUND_COLOR = "#2e2e2e";
    stovis.DEFAULT_FILL_COLOR = "#ffbaba";
    stovis.DEFAULT_STROKE_COLOR = "#ff7a7a";

    /** max field size in pixel */
    stovis.MAX_FIELD_LENGTH = 20000;

    /**
    Experimental - Not using it. I keep it here to experiment about ui encapsulation/ web components / whatever
    */
    var ExperimentalElem = (function () {
        function ExperimentalElem() {
            this._backgroundColor = stovis.DEFAULT_BACKGROUND_COLOR;
        }
        Object.defineProperty(ExperimentalElem.prototype, "backgroundColor", {
            get: function () {
                return this._backgroundColor;
            },
            set: function (backgroundColor) {
                this._backgroundColor = backgroundColor;
            },
            enumerable: true,
            configurable: true
        });


        Object.defineProperty(ExperimentalElem.prototype, "foregroundColor", {
            get: function () {
                return this._foregroundColor;
            },
            set: function (foregroundColor) {
                this._foregroundColor = foregroundColor;
            },
            enumerable: true,
            configurable: true
        });

        return ExperimentalElem;
    })();

    var Editor = (function () {
        function Editor(container) {
            console.log("Beginning of Editor constructor ");
            var self = this;

            this.container = container;

            var width = 960, height = 500, fill = d3.scale.category20();

            // mouse event vars
            var selected_node = null, selected_link = null, mousedown_link = null, mousedown_node = null, mouseup_node = null;

            // init svg
            var outer = d3.select(this.container).append("svg:svg").attr("width", width).attr("height", height).attr("pointer-events", "all");

            var outZoom = d3.behavior.zoom().on("zoom", rescale);
            var translate = [0.0, 0.0];
            var scale = 1.0;
            var vis = outer.append('svg:g').call(outZoom).on("dblclick.zoom", null).append('svg:g').on("mousemove", mousemove).on("mousedown", mousedown).on("mouseup", mouseup);

            vis.append('svg:rect').attr('width', width).attr('height', height).attr('fill', 'white');

            // init force layout
            var force = d3.layout.force().size([width, height]).nodes([{}]).linkDistance(50).charge(-200).on("tick", tick);

            // line displayed when dragging new nodes
            var drag_line = vis.append("line").attr("class", "drag_line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 0);

            // get layout properties
            var nodes = force.nodes(), links = force.links(), node = vis.selectAll(".node"), link = vis.selectAll(".link");

            // add keyboard callback
            d3.select(window).on("keydown", keydown);

            // rescale g
            function rescale() {
                if (mousedown_node || mousedown_link) {
                    // Revert the changes
                    outZoom.scale(scale);
                    outZoom.translate(translate);
                    return;
                } else {
                    translate = d3.event.translate;
                    scale = d3.event.scale;

                    vis.attr("transform", "translate(" + translate + ")" + " scale(" + scale + ")");
                }
            }

            redraw();

            // focus on svg
            // vis.node().focus();
            function mousedown() {
                console.log("mousedown");
                console.log("mousedown_node: ", mousedown_node);
                console.log("mousedown_link: ", mousedown_link);
                if (!mousedown_node && !mousedown_link) {
                    console.log("We're allowing panning");

                    // allow panning if nothing is selected
                    //vis.call(d3.behavior.zoom().on("zoom"), rescale);
                    vis.call(d3.behavior.zoom().on("zoom", rescale));
                    return;
                } else {
                    console.log("No panning");
                    //vis.call(d3.behavior.zoom().on("zoom", null))
                }
            }

            function mousemove() {
                if (!mousedown_node)
                    return;
                var point = d3.mouse(self.container);

                // update drag line
                drag_line.attr("x1", mousedown_node.x).attr("y1", mousedown_node.y).attr("x2", point[0]).attr("y2", point[1]);
            }

            function mouseup() {
                console.log("mouseup");
                console.log("mousedown_node: ", mousedown_node);
                if (mousedown_node) {
                    // hide drag line
                    drag_line.attr("class", "drag_line_hidden");

                    if (!mouseup_node) {
                        // add node
                        var point = d3.mouse(this), node = { x: point[0], y: point[1] }, n = nodes.push(node);

                        // select new node
                        selected_node = node;
                        selected_link = null;

                        // add link to mousedown node
                        links.push({ source: mousedown_node, target: node });
                    }

                    redraw();
                }

                // clear mouse event vars
                resetMouseVars();
            }

            function resetMouseVars() {
                mousedown_node = null;
                mouseup_node = null;
                mousedown_link = null;
            }

            function tick() {
                link.attr("x1", function (d) {
                    return d.source.x;
                }).attr("y1", function (d) {
                    return d.source.y;
                }).attr("x2", function (d) {
                    return d.target.x;
                }).attr("y2", function (d) {
                    return d.target.y;
                });

                node.attr("cx", function (d) {
                    return d.x;
                }).attr("cy", function (d) {
                    return d.y;
                });
            }

            // redraw force layout
            function redraw() {
                link = link.data(links);

                link.enter().insert("line", ".node").attr("class", "link").on("mousedown", function (d) {
                    mousedown_link = d;
                    if (mousedown_link == selected_link)
                        selected_link = null;
else
                        selected_link = mousedown_link;
                    selected_node = null;
                    redraw();
                });

                link.exit().remove();

                link.classed("link_selected", function (d) {
                    return d === selected_link;
                });

                node = node.data(nodes);

                node.enter().insert("circle").attr("class", "node").attr("r", 5).on("mousedown", function (d) {
                    // disable zoom
                    //vis.call(d3.behavior.zoom().on("zoom"), null);
                    vis.call(d3.behavior.zoom().on("zoom", null));

                    mousedown_node = d;
                    if (mousedown_node == selected_node)
                        selected_node = null;
else
                        selected_node = mousedown_node;
                    selected_link = null;

                    // reposition drag line
                    drag_line.attr("class", "link").attr("x1", mousedown_node.x).attr("y1", mousedown_node.y).attr("x2", mousedown_node.x).attr("y2", mousedown_node.y);

                    redraw();
                }).on("mousedrag", function (d) {
                    console.log("mousedrag -redraw");
                    // redraw();
                }).on("mouseup", function (d) {
                    console.log("mouseup - redraw");
                    console.log("mousedown_node: ", mousedown_node);
                    if (mousedown_node) {
                        mouseup_node = d;
                        if (mouseup_node == mousedown_node) {
                            resetMouseVars();
                            return;
                        }

                        // add link
                        var link = { source: mousedown_node, target: mouseup_node };
                        links.push(link);

                        // select new link
                        selected_link = link;
                        selected_node = null;

                        // enable zoom
                        //vis.call(d3.behavior.zoom().on("zoom"), rescale);
                        vis.call(d3.behavior.zoom().on("zoom", rescale));
                        redraw();
                    }
                }).transition().duration(750).ease("elastic").attr("r", 6.5);

                node.exit().transition().attr("r", 0).remove();

                node.classed("node_selected", function (d) {
                    return d === selected_node;
                });

                if (d3.event) {
                    // prevent browser's default behavior
                    d3.event.preventDefault();
                }

                force.start();
            }

            function spliceLinksForNode(node) {
                var toSplice = links.filter(function (l) {
                    return (l.source === node) || (l.target === node);
                });
                toSplice.map(function (l) {
                    links.splice(links.indexOf(l), 1);
                });
            }

            function keydown() {
                if (!selected_node && !selected_link)
                    return;
                switch (d3.event.keyCode) {
                    case 8:
                    case 46: {
                        if (selected_node) {
                            nodes.splice(nodes.indexOf(selected_node), 1);
                            spliceLinksForNode(selected_node);
                        } else if (selected_link) {
                            links.splice(links.indexOf(selected_link), 1);
                        }
                        selected_link = null;
                        selected_node = null;
                        redraw();
                        break;
                    }
                }
            }
            console.log("Done with Editor constructor");
        }
        Editor.prototype.initArrows = function () {
            this.arrows = [];

            // no arrow
            this.arrows.push(this.svg.append('svg:defs').append('svg:marker').attr('id', 'arrow-0').attr('viewBox', '0 -5 10 10').attr('refX', 6).attr('markerWidth', 3).attr('markerHeight', 3).attr('orient', 'auto'));

            // single arrow
            // define arrow markers for graph links
            this.arrows.push(this.svg.append('svg:defs').append('svg:marker').attr('id', 'arrow-1').attr('viewBox', '0 -5 10 10').attr('refX', 6).attr('markerWidth', 3).attr('markerHeight', 3).attr('orient', 'auto').append('svg:path').attr('d', 'M0,-5L10,0L0,5').attr('fill', 'context-fill'));

            // double arrow
            this.arrows.push(this.svg.append('svg:defs').append('svg:marker'));

            this.arrows[2].attr('id', 'arrow-2').attr('viewBox', '0 -5 20 20').attr('refX', 17).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto').append('svg:path').attr('d', 'M0,-5L10,0L0,5').attr('fill', 'context-fill');

            this.arrows[2].append('svg:path').attr('d', 'M10,-5L20,0L10,5').attr('fill', 'context-fill');
        };
        Editor.labels = ["L", "[]", "head", "tail"];
        return Editor;
    })();
    stovis.Editor = Editor;

    /**
    sto new
    example from http://rkirsling.github.io/modallogic/ thanks to Ross Kirsling
    */
    function addEditor(container) {
        return new Editor(container);
    }
    stovis.addEditor = addEditor;
})(stovis || (stovis = {}));
