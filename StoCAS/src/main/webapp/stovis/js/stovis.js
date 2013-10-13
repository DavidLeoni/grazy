/// <reference path="libs/d3/d3.d.ts" />
/// <reference path="../../stocore/js/libs/jquery/jquery.d.ts" />
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
    Experimental - Not using it. Kept here to experiment about ui encapsulation/ web components / whatever
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
            var _this = this;
            console.log("Beginning of Editor constructor ");

            this.container = container;

            this.width = 960;
            this.height = 500;

            // mouse event vars
            this.selected_node = null, this.selected_link = null, this.mousedown_link = null, this.mousedown_node = null, this.mouseup_node = null;

            // init svg
            this.svg = d3.select(this.container).append("svg:svg").attr("width", this.width).attr("height", this.height).attr("pointer-events", "all");

            this.outZoom = d3.behavior.zoom().on("zoom", function () {
                return _this.rescale();
            });
            this.translate = [0.0, 0.0];
            this.scale = 1.0;
            this.vis = this.svg.append('svg:g').call(this.outZoom).on("dblclick.zoom", null).append('svg:g').on("mousemove", function () {
                return _this.mousemove();
            }).on("mousedown", function () {
                return _this.mousedown();
            }).on("mouseup", function () {
                return _this.mouseup();
            });

            this.vis.append('svg:rect').attr('width', this.width).attr('height', this.height).attr('fill', 'white');

            // init force layout
            this.force = d3.layout.force().size([this.width, this.height]).nodes([{}]).linkDistance(50).charge(-200).on("tick", function () {
                return _this.tick();
            });

            // line displayed when dragging new nodes
            this.drag_line = this.vis.append("line").attr("class", "drag_line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 0);

            // get layout properties
            this.node = this.vis.selectAll(".node"), this.link = this.vis.selectAll(".link");

            // add keyboard callback
            d3.select(window).on("keydown", function () {
                return _this.keydown();
            });

            this.redraw();

            // focus on svg
            // vis.node().focus();
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

        Editor.prototype.mousedown = function () {
            var _this = this;
            console.log("mousedown");
            console.log("mousedown_node: ", this.mousedown_node);
            console.log("mousedown_link: ", this.mousedown_link);
            if (!this.mousedown_node && !this.mousedown_link) {
                console.log("We're allowing panning");

                // allow panning if nothing is selected
                //vis.call(d3.behavior.zoom().on("zoom"), rescale);
                this.vis.call(d3.behavior.zoom().on("zoom", function () {
                    return _this.rescale();
                }));
                return;
            } else {
                console.log("No panning");
                //vis.call(d3.behavior.zoom().on("zoom", null))
            }
        };

        Editor.prototype.mousemove = function () {
            if (!this.mousedown_node)
                return;
            var point = d3.mouse($("svg g g")[0]);

            // update drag line
            this.drag_line.attr("x1", this.mousedown_node.x).attr("y1", this.mousedown_node.y).attr("x2", point[0]).attr("y2", point[1]);
        };

        Editor.prototype.mouseup = function () {
            console.log("mouseup");
            console.log("mousedown_node: ", this.mousedown_node);
            if (this.mousedown_node) {
                // hide drag line
                this.drag_line.attr("class", "drag_line_hidden");

                if (!this.mouseup_node) {
                    // add node
                    var point = d3.mouse($("svg g g")[0]), newnode = { x: point[0], y: point[1] };

                    this.force.nodes().push(newnode);

                    // select new node
                    this.selected_node = newnode;
                    this.selected_link = null;

                    // add link to mousedown node
                    this.force.links().push({ source: this.mousedown_node, target: newnode });
                }

                this.redraw();
            }

            // clear mouse event vars
            this.resetMouseVars();
        };

        Editor.prototype.resetMouseVars = function () {
            this.mousedown_node = null;
            this.mouseup_node = null;
            this.mousedown_link = null;
        };

        Editor.prototype.tick = function () {
            this.link.attr("x1", function (d) {
                return d.source.x;
            }).attr("y1", function (d) {
                return d.source.y;
            }).attr("x2", function (d) {
                return d.target.x;
            }).attr("y2", function (d) {
                return d.target.y;
            });

            this.node.attr("cx", function (d) {
                return d.x;
            }).attr("cy", function (d) {
                return d.y;
            });
        };

        // redraw force layout
        Editor.prototype.redraw = function () {
            var _this = this;
            this.link = this.link.data(this.force.links());

            this.link.enter().insert("line", ".node").attr("class", "link").on("mousedown", function (d) {
                _this.mousedown_link = d;
                if (_this.mousedown_link == _this.selected_link)
                    _this.selected_link = null;
else
                    _this.selected_link = _this.mousedown_link;
                _this.selected_node = null;
                _this.redraw();
            });

            this.link.exit().remove();

            this.link.classed("link_selected", function (d) {
                return (d === _this.selected_link);
            });

            this.node = this.node.data(this.force.nodes());

            this.node.enter().insert("circle").attr("class", "node").attr("r", 5).on("mousedown", function (d) {
                // disable zoom
                //vis.call(d3.behavior.zoom().on("zoom"), null);
                _this.vis.call(d3.behavior.zoom().on("zoom", null));

                _this.mousedown_node = d;
                if (_this.mousedown_node === _this.selected_node) {
                    _this.selected_node = null;
                } else {
                    _this.selected_node = _this.mousedown_node;
                }
                _this.selected_link = null;

                // reposition drag line
                _this.drag_line.attr("class", "link").attr("x1", _this.mousedown_node.x).attr("y1", _this.mousedown_node.y).attr("x2", _this.mousedown_node.x).attr("y2", _this.mousedown_node.y);

                _this.redraw();
            }).on("mousedrag", function (d) {
                console.log("mousedrag -redraw");
                // redraw();
            }).on("mouseup", function (d) {
                console.log("mouseup - redraw");
                console.log("mousedown_node: ", _this.mousedown_node);
                if (_this.mousedown_node) {
                    _this.mouseup_node = d;
                    if (_this.mouseup_node == _this.mousedown_node) {
                        _this.resetMouseVars();
                        return;
                    }

                    // add link
                    var newlink = { source: _this.mousedown_node, target: _this.mouseup_node };
                    _this.force.links().push(newlink);

                    // select new link
                    _this.selected_link = newlink;
                    _this.selected_node = null;

                    // enable zoom
                    //vis.call(d3.behavior.zoom().on("zoom"), rescale);
                    _this.vis.call(d3.behavior.zoom().on("zoom", function () {
                        return _this.rescale();
                    }));
                    _this.redraw();
                }
            }).transition().duration(750).ease("elastic").attr("r", 6.5);

            this.node.exit().transition().attr("r", 0).remove();

            this.node.classed("node_selected", function (d) {
                return (d === _this.selected_node);
            });

            if (d3.event) {
                // prevent browser's default behavior
                d3.event.preventDefault();
            }

            console.log("force = ", this.force);
            this.force.start();
        };

        Editor.prototype.spliceLinksForNode = function (node) {
            var _this = this;
            var toSplice = this.force.links().filter(function (l) {
                return ((l.source === node) || (l.target === node));
            });
            toSplice.map(function (l) {
                return _this.force.links().splice(_this.force.links().indexOf(l), 1);
            });
        };

        Editor.prototype.keydown = function () {
            if (!this.selected_node && !this.selected_link)
                return;
            switch (d3.event.keyCode) {
                case 8:
                case 46: {
                    if (this.selected_node) {
                        this.force.nodes().splice(this.force.nodes().indexOf(this.selected_node), 1);
                        this.spliceLinksForNode(this.selected_node);
                    } else if (this.selected_link) {
                        this.force.links().splice(this.force.links().indexOf(this.selected_link), 1);
                    }
                    this.selected_link = null;
                    this.selected_node = null;
                    this.redraw();
                    break;
                }
            }
        };

        // rescale g
        Editor.prototype.rescale = function () {
            if (this.mousedown_node || this.mousedown_link) {
                // Revert the changes - hack to prevent panning thanks to http://stackoverflow.com/questions/19249587/nested-zooms-issue-in-d3, Phong Nguyen answer
                this.outZoom.scale(this.scale);
                this.outZoom.translate(this.translate);
                return;
            } else {
                this.translate = d3.event.translate;
                this.scale = d3.event.scale;

                this.vis.attr("transform", "translate(" + this.translate + ")" + " scale(" + this.scale + ")");
            }
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
