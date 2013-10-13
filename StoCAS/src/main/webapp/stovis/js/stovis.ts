/// <reference path="libs/d3/d3.d.ts" />
/// <reference path="../../stocore/js/libs/jquery/jquery.d.ts" />
/// <reference path="../../stocore/js/stocore.ts" />


// Module
module stovis {

    export var DEFAULT_BACKGROUND_COLOR = "#2e2e2e";
    export var DEFAULT_FILL_COLOR = "#ffbaba";
    export var DEFAULT_STROKE_COLOR = "#ff7a7a";
    /** max field size in pixel */
    export var MAX_FIELD_LENGTH = 20000;

    /**
        Experimental - Not using it. Kept here to experiment about ui encapsulation/ web components / whatever 
    */
    class ExperimentalElem {
        private _backgroundColor: String;
        private _foregroundColor: String;
        constructor() {
            this._backgroundColor = DEFAULT_BACKGROUND_COLOR;
        }

        get backgroundColor(): String {
            return this._backgroundColor;
        }

        set backgroundColor(backgroundColor: String) {
            this._backgroundColor = backgroundColor;
        }

        get foregroundColor(): String {
            return this._foregroundColor;
        }

        set foregroundColor(foregroundColor: String) {
            this._foregroundColor = foregroundColor;
        }


    }



    export class Editor {

        /** 
            Labels to put on nodes 
        */
        static labels: Array<String> = ["L", "[]", "head", "tail"];
        /** 
            Arrow markers for graph links
        */
        private arrows: Array<any>;
        private container: HTMLElement;
        private svg: any;
        private force: D3.Layout.ForceLayout;
        private selected_node: any;
        private selected_link: any;
        private mousedown_link;
        private mousedown_node;
        private mouseup_node;
        private drag_line: any;
        private path: any; // to review
        private width: number;
        private height: number;
        private outZoom: any;
        private vis: any;
        private scale: number;
        private translate: Array<number>;
        private link: any; // todo rename
        private node: any; // todo rename

        private initArrows(): void {
            this.arrows = [];
            // no arrow
            this.arrows.push(this.svg.append('svg:defs').append('svg:marker')
                .attr('id', 'arrow-0')
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 6)
                .attr('markerWidth', 3)
                .attr('markerHeight', 3)
                .attr('orient', 'auto'));


            // single arrow
            // define arrow markers for graph links
            this.arrows.push(this.svg.append('svg:defs').append('svg:marker')
                .attr('id', 'arrow-1')
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 6)
                .attr('markerWidth', 3)
                .attr('markerHeight', 3)
                .attr('orient', 'auto')
                .append('svg:path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', 'context-fill'));


            // double arrow
            this.arrows.push(this.svg.append('svg:defs').append('svg:marker'));

            this.arrows[2].attr('id', 'arrow-2')
                .attr('viewBox', '0 -5 20 20')  // first two numbers are start position, next are width and height
                .attr('refX', 17)   // entrance point before the line
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto')
                .append('svg:path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', 'context-fill')

            this.arrows[2].append('svg:path')
                .attr('d', 'M10,-5L20,0L10,5') //M Move, L = LineTo  Capital = absolute
                .attr('fill', 'context-fill');
        }

        constructor(container: HTMLElement) {
            console.log("Beginning of Editor constructor ");

            this.container = container;

            this.width = 960;
            this.height = 500;


            // mouse event vars
            this.selected_node = null,
            this.selected_link = null,
            this.mousedown_link = null,
            this.mousedown_node = null,
            this.mouseup_node = null;

            // init svg
            this.svg = d3.select(this.container)
                .append("svg:svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("pointer-events", "all");

            this.outZoom = d3.behavior.zoom().on("zoom", () => this.rescale());
            this.translate = [0.0, 0.0];
            this.scale = 1.0;
            this.vis = this.svg
                .append('svg:g')
                .call(this.outZoom)
                .on("dblclick.zoom", null)
                .append('svg:g')
                .on("mousemove", () => this.mousemove())
                .on("mousedown", () => this.mousedown())
                .on("mouseup", () => this.mouseup());

            this.vis.append('svg:rect')
                .attr('width', this.width)
                .attr('height', this.height)
                .attr('fill', 'white');

            // init force layout
            this.force = d3.layout.force()
                .size([this.width, this.height])
                .nodes([{}]) // initialize with a single node
                .linkDistance(50)
                .charge(-200)
                .on("tick", () => this.tick());


            // line displayed when dragging new nodes
            this.drag_line = this.vis.append("line")
                .attr("class", "drag_line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 0)
                .attr("y2", 0);

            // get layout properties
            this.node = this.vis.selectAll(".node"),
            this.link = this.vis.selectAll(".link");

            // add keyboard callback
            d3.select(window)
                .on("keydown", () => this.keydown());



            this.redraw();

            // focus on svg
            // vis.node().focus();


            console.log("Done with Editor constructor");
        }


        mousedown() {
            console.log("mousedown");
            console.log("mousedown_node: ", this.mousedown_node);
            console.log("mousedown_link: ", this.mousedown_link);
            if (!this.mousedown_node && !this.mousedown_link) {
                console.log("We're allowing panning");
                // allow panning if nothing is selected


                //vis.call(d3.behavior.zoom().on("zoom"), rescale); 
                this.vis.call(d3.behavior.zoom().on("zoom", () => this.rescale()));
                return;
            } else {
                console.log("No panning");
                //vis.call(d3.behavior.zoom().on("zoom", null))


            }
        }

        mousemove() {
            //console.log("mousemove");
            //console.log("mousedown_node: ", mousedown_node);
            if (!this.mousedown_node) return;
            var point = d3.mouse($("svg g g")[0]);
            // update drag line
            this.drag_line
                .attr("x1", this.mousedown_node.x)
                .attr("y1", this.mousedown_node.y)
                .attr("x2", point[0])
                .attr("y2", point[1]);

        }

        mouseup() {
            console.log("mouseup");
            console.log("mousedown_node: ", this.mousedown_node);
            if (this.mousedown_node) {
                // hide drag line
                this.drag_line
                    .attr("class", "drag_line_hidden")

                    if (!this.mouseup_node) {
                    // add node
                        var point = d3.mouse($("svg g g")[0]),
                        newnode = { x: point[0], y: point[1] };

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
        }

        resetMouseVars() {
            this.mousedown_node = null;
            this.mouseup_node = null;
            this.mousedown_link = null;
        }

        tick() {
            this.link.attr("x1", (d) => d.source.x)
                .attr("y1", (d) => d.source.y)
                .attr("x2", (d) => d.target.x)
                .attr("y2", (d) => d.target.y);

            this.node.attr("cx", (d) => d.x)
                .attr("cy", (d) => d.y);
        }

        // redraw force layout
        redraw() {

            this.link = this.link.data(this.force.links());

            this.link.enter().insert("line", ".node")
                .attr("class", "link")
                .on("mousedown",
                (d) => {
                    this.mousedown_link = d;
                    if (this.mousedown_link == this.selected_link) this.selected_link = null;
                    else this.selected_link = this.mousedown_link;
                    this.selected_node = null;
                    this.redraw();
                })

            this.link.exit().remove();

            this.link
                .classed("link_selected", (d) => (d === this.selected_link));

            this.node = this.node.data(this.force.nodes());

            this.node.enter().insert("circle")
                .attr("class", "node")
                .attr("r", 5)
                .on("mousedown",
                (d) => {
                    // disable zoom
                    //vis.call(d3.behavior.zoom().on("zoom"), null);
                    this.vis.call(d3.behavior.zoom().on("zoom", null));

                    this.mousedown_node = d;
                    if (this.mousedown_node === this.selected_node) {
                        this.selected_node = null;
                    } else {
                        this.selected_node = this.mousedown_node;
                    }
                    this.selected_link = null;

                    // reposition drag line
                    this.drag_line
                        .attr("class", "link")
                        .attr("x1", this.mousedown_node.x)
                        .attr("y1", this.mousedown_node.y)
                        .attr("x2", this.mousedown_node.x)
                        .attr("y2", this.mousedown_node.y);

                    this.redraw();
                })
                .on("mousedrag",
                (d) => {
                    console.log("mousedrag -redraw");
                    // redraw();
                })
                .on("mouseup",
                (d) => {
                    console.log("mouseup - redraw");
                    console.log("mousedown_node: ", this.mousedown_node);
                    if (this.mousedown_node) {
                        this.mouseup_node = d;
                        if (this.mouseup_node == this.mousedown_node) {
                            this.resetMouseVars(); return;
                        }

                        // add link
                        var newlink = { source: this.mousedown_node, target: this.mouseup_node };
                        this.force.links().push(newlink);

                        // select new link
                        this.selected_link = newlink;
                        this.selected_node = null;

                        // enable zoom
                        //vis.call(d3.behavior.zoom().on("zoom"), rescale);
                        this.vis.call(d3.behavior.zoom().on("zoom", () => this.rescale()))
                        this.redraw();
                    }
                })
                .transition()
                .duration(750)
                .ease("elastic")
                .attr("r", 6.5);

            this.node.exit().transition()
                .attr("r", 0)
                .remove();

            this.node.classed("node_selected", (d) => (d === this.selected_node));



            if (d3.event) {
                // prevent browser's default behavior
                d3.event.preventDefault();
            }

            console.log("force = ", this.force);
            this.force.start();

        }

        spliceLinksForNode(node) {
            var toSplice = this.force.links().filter(
                (l) => ((l.source === node) || (l.target === node)));
            toSplice.map((l) => this.force.links().splice(this.force.links().indexOf(l), 1));
        }

        keydown() {
            if (!this.selected_node && !this.selected_link) return;
            switch (d3.event.keyCode) {
                case 8: // backspace
                case 46: { // delete
                    if (this.selected_node) {
                        this.force.nodes().splice(this.force.nodes().indexOf(this.selected_node), 1);
                        this.spliceLinksForNode(this.selected_node);
                    }
                    else if (this.selected_link) {
                        this.force.links().splice(this.force.links().indexOf(this.selected_link), 1);
                    }
                    this.selected_link = null;
                    this.selected_node = null;
                    this.redraw();
                    break;
                }
            }
        }
        // rescale g
        rescale(): void {
            if (this.mousedown_node || this.mousedown_link) {
                // Revert the changes - hack to prevent panning thanks to http://stackoverflow.com/questions/19249587/nested-zooms-issue-in-d3, Phong Nguyen answer
                this.outZoom.scale(this.scale);
                this.outZoom.translate(this.translate);
                return;
            } else {

                this.translate = d3.event.translate;
                this.scale = d3.event.scale;

                this.vis.attr("transform",
                    "translate(" + this.translate + ")"
                    + " scale(" + this.scale + ")");
            }
        }
    }



    export function addEditor(container: HTMLElement): Editor {
        return new Editor(container);

    }

}

