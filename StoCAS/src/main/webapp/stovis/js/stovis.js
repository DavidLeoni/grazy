/// <reference path="libs/d3/d3.d.ts" />
/// <reference path="../../stocore/js/stocore.ts" />
// Module
var stovis;
(function (stovis) {
    stovis.DEFAULT_BACKGROUND_COLOR = "#2e2e2e";
    stovis.DEFAULT_FILL_COLOR = "#ffbaba";
    stovis.DEFAULT_STROKE_COLOR = "#ff7a7a";

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
            var _this = this;
            console.log("Beginning of Editor constructor ");

            this.container = container;

            // set up SVG for D3
            this.width = 960;
            this.height = 500;
            this.colors = d3.scale.category10();

            this.svg = d3.select('body').append('svg').attr('width', this.width).attr('height', this.height).attr("stroke", stovis.DEFAULT_STROKE_COLOR).attr("fill", stovis.DEFAULT_FILL_COLOR).style("cursor", "default").style("-webkit-user-select", "none").style("-moz-user-select", "none").style("-ms-user-select", "none").style("-o-user-select", "none").style("user-select", "none");

            // silly way to set a background color, currently (Oct 2013) the 'good' one is not supported in Firefox http://www.w3.org/TR/SVGTiny12/painting.html#viewport-fill-property
            this.svg.append('rect').attr("style", "fill:" + stovis.DEFAULT_BACKGROUND_COLOR).attr("width", "100%").attr("height", "100%");

            console.log("svg = ", this.svg);

            this.initArrows();

            // set up initial nodes and links
            //  - nodes are known by 'id', not by index in array.
            //  - sticky edges are indicated on the node (as a bold black circle).
            //  - links are always source < target; edge directions are set by 'left' and 'right'.
            this.nodes = [
                { id: 0, sticky: false },
                { id: 1, sticky: true },
                { id: 2, sticky: false }
            ];
            this.lastNodeId = 2, this.links = [
                { source: this.nodes[0], target: this.nodes[1], left: false, right: true },
                { source: this.nodes[1], target: this.nodes[2], left: false, right: true }
            ];

            // init D3 force layout
            this.force = d3.layout.force().nodes(this.nodes).links(this.links).size([this.width, this.height]).linkDistance(150).charge(-500).on('tick', function () {
                return _this.tick();
            });

            // line displayed when dragging new nodes
            this.drag_line = this.svg.append('svg:path').attr('class', 'link dragline hidden').attr('d', 'M0,0L0,0');

            // handles to link and node element groups
            this.path = this.svg.append('svg:g').selectAll('path'), this.circle = this.svg.append('svg:g').selectAll('g');

            // mouse event vars
            this.selected_node = null;
            this.selected_link = null;
            this.mousedown_link = null;
            this.mousedown_node = null;
            this.mouseup_node = null;

            // only respond once per keydown
            this.lastKeyDown = -1;

            // app starts here
            this.svg.on('mousedown', function () {
                return _this.mousedown();
            }).on('mousemove', function () {
                return _this.mousemove();
            }).on('mouseup', function () {
                return _this.mouseup();
            });
            d3.select(window).on('keydown', function () {
                return _this.keydown();
            }).on('keyup', function () {
                return _this.keyup();
            });
            this.restart();
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

        Editor.prototype.resetMouseVars = function () {
            this.mousedown_node = null;
            this.mouseup_node = null;
            this.mousedown_link = null;
        };

        // update force layout (called automatically each iteration)
        Editor.prototype.tick = function () {
            // draw directed edges with proper padding from node centers
            this.path.attr('d', function (d) {
                var deltaX = d.target.x - d.source.x, deltaY = d.target.y - d.source.y, dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY), normX = deltaX / dist, normY = deltaY / dist, sourcePadding = d.left ? 17 : 12, targetPadding = d.right ? 17 : 12, sourceX = d.source.x + (sourcePadding * normX), sourceY = d.source.y + (sourcePadding * normY), targetX = d.target.x - (targetPadding * normX), targetY = d.target.y - (targetPadding * normY);
                return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
            });

            this.circle.attr('transform', function (d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            });
        };

        Editor.prototype.mousedown = function () {
            console.log("Beginning mousedown function");

            // prevent I-bar on drag
            //d3.event.preventDefault();
            // because :active only works in WebKit?
            this.svg.classed('active', true);

            if (d3.event.ctrlKey || this.mousedown_node || this.mousedown_link)
                return;

            // insert new node at point
            console.log("inserting new node");
            var point = d3.mouse(this.container), node = { id: ++this.lastNodeId, sticky: false };
            node.x = point[0];
            node.y = point[1];
            this.nodes.push(node);

            this.restart();
        };

        Editor.prototype.mousemove = function () {
            if (!this.mousedown_node)
                return;

            // update drag line
            this.drag_line.attr('d', 'M' + this.mousedown_node.x + ',' + this.mousedown_node.y + 'L' + d3.mouse(this.container)[0] + ',' + d3.mouse(this.container)[1]);

            this.restart();
        };

        Editor.prototype.mouseup = function () {
            if (this.mousedown_node) {
                // hide drag line
                this.drag_line.classed('hidden', true).style('marker-end', '');
            }

            // because :active only works in WebKit?
            this.svg.classed('active', false);

            // clear mouse event vars
            this.resetMouseVars();
        };

        // update graph (called when needed)
        Editor.prototype.restart = function () {
            var _this = this;
            var self = this;

            // path (link) group
            this.path = this.path.data(this.links);

            // update existing links
            this.path.classed('selected', function (d) {
                return (d === _this.selected_link);
            }).style('marker-end', 'url(#arrow-1)');

            // add new links
            this.path.enter().append('svg:path').attr('class', 'link').classed('selected', function (d) {
                return (d === _this.selected_link);
            }).style('marker-end', 'url(#arrow-1)').on('mousedown', function (d) {
                if (d3.event.ctrlKey)
                    return;

                // select link
                _this.mousedown_link = d;
                if (_this.mousedown_link === _this.selected_link)
                    _this.selected_link = null;
else
                    _this.selected_link = _this.mousedown_link;
                _this.selected_node = null;
                _this.restart();
            });

            // remove old links
            this.path.exit().remove();

            // circle (node) group
            // NB: the function arg is crucial here! nodes are known by id, not by index!
            this.circle = this.circle.data(this.nodes, function (d) {
                return d.id;
            });

            // update existing nodes (sticky & selected visual states)
            this.circle.selectAll('circle').style('fill', function (d) {
                return (d === _this.selected_node) ? d3.rgb(stovis.DEFAULT_BACKGROUND_COLOR).brighter().toString() : stovis.DEFAULT_BACKGROUND_COLOR;
            }).classed('sticky', function (d) {
                return d.sticky;
            });

            // add new nodes
            var g = this.circle.enter().append('svg:g');

            g.append('svg:circle').attr('class', 'node').attr('r', 12).style('fill', function (d) {
                return (d === _this.selected_node) ? d3.rgb(stovis.DEFAULT_BACKGROUND_COLOR).brighter().toString() : stovis.DEFAULT_BACKGROUND_COLOR;
            }).style('stroke', function (d) {
                return d3.rgb(stovis.DEFAULT_STROKE_COLOR).darker().toString();
            }).classed('sticky', function (d) {
                return d.sticky;
            }).on('mouseover', function (d) {
                if (!self.mousedown_node || d === self.mousedown_node)
                    return;

                // enlarge target node
                d3.select(this).attr('transform', 'scale(1.1)');
            }).on('mouseout', function (d) {
                if (!self.mousedown_node || d === self.mousedown_node)
                    return;

                // unenlarge target node
                d3.select(this).attr('transform', '');
            }).on('mousedown', function (d) {
                if (d3.event.ctrlKey)
                    return;

                // select node
                _this.mousedown_node = d;
                if (_this.mousedown_node === _this.selected_node) {
                    _this.selected_node = null;
                } else {
                    _this.selected_node = _this.mousedown_node;
                }
                _this.selected_link = null;

                // reposition drag line
                _this.drag_line.style('marker-end', 'url(#arrow-1)').classed('hidden', false).attr('d', 'M' + _this.mousedown_node.x + ',' + _this.mousedown_node.y + 'L' + _this.mousedown_node.x + ',' + _this.mousedown_node.y);

                _this.restart();
            }).on('mouseup', function (d) {
                if (!self.mousedown_node)
                    return;

                // needed by FF
                self.drag_line.classed('hidden', true).style('marker-end', '');

                // check for drag-to-self
                self.mouseup_node = d;
                if (self.mouseup_node === self.mousedown_node) {
                    self.resetMouseVars();
                    return;
                }

                // unenlarge target node
                d3.select(this).attr('transform', '');

                // add link to graph (update if exists)
                // NB: links are strictly source < target; arrows separately specified by booleans
                var source, target, direction;
                if (self.mousedown_node.id < self.mouseup_node.id) {
                    source = self.mousedown_node;
                    target = self.mouseup_node;
                    direction = 'right';
                } else {
                    source = self.mouseup_node;
                    target = self.mousedown_node;
                    direction = 'left';
                }

                var link;
                link = self.links.filter(function (l) {
                    return (l.source === source && l.target === target);
                })[0];

                if (link) {
                    link[direction] = true;
                } else {
                    link = { source: source, target: target, left: false, right: false };
                    link[direction] = true;
                    self.links.push(link);
                }

                // select new link
                self.selected_link = link;
                self.selected_node = null;
                self.restart();
            });

            // show node IDs
            g.append('svg:text').attr('x', 0).attr('y', 4).attr('class', 'id').text(function (d) {
                return d.id;
            });

            // remove old nodes
            this.circle.exit().remove();

            // set the graph in motion
            this.force.start();
        };

        Editor.prototype.spliceLinksForNode = function (node) {
            var _this = this;
            var toSplice = this.links.filter(function (l) {
                return (l.source === node || l.target === node);
            });
            toSplice.map(function (l) {
                return _this.links.splice(_this.links.indexOf(l), 1);
            });
        };

        Editor.prototype.keydown = function () {
            d3.event.preventDefault();

            if (this.lastKeyDown !== -1)
                return;
            this.lastKeyDown = d3.event.keyCode;

            if (d3.event.keyCode === 17) {
                this.circle.call(this.force.drag);
                this.svg.classed('ctrl', true);
            }

            if (!this.selected_node && !this.selected_link)
                return;
            switch (d3.event.keyCode) {
                case 8:
                case 46:
                    if (this.selected_node) {
                        this.nodes.splice(this.nodes.indexOf(this.selected_node), 1);
                        this.spliceLinksForNode(this.selected_node);
                    } else if (this.selected_link) {
                        this.links.splice(this.links.indexOf(this.selected_link), 1);
                    }
                    this.selected_link = null;
                    this.selected_node = null;
                    this.restart();
                    break;
                case 66:
                    if (this.selected_link) {
                        // set link direction to both left and right
                        this.selected_link.left = true;
                        this.selected_link.right = true;
                    }
                    this.restart();
                    break;
                case 76:
                    if (this.selected_link) {
                        // set link direction to left only
                        this.selected_link.left = true;
                        this.selected_link.right = false;
                    }
                    this.restart();
                    break;
                case 82:
                    if (this.selected_node) {
                        this.selected_node.sticky = !this.selected_node.sticky;
                    } else if (this.selected_link) {
                        // set link direction to right only
                        this.selected_link.left = false;
                        this.selected_link.right = true;
                    }
                    this.restart();
                    break;
            }
        };

        Editor.prototype.keyup = function () {
            this.lastKeyDown = -1;

            if (d3.event.keyCode === 17) {
                this.circle.on('mousedown.drag', null).on('touchstart.drag', null);
                this.svg.classed('ctrl', false);
            }
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
