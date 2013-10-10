/// <reference path="../../js/libs/d3/d3.d.ts" />
var d3Tests;
(function (d3Tests) {
    /**
    sto new
    So iis server doesn't give me 406
    */
    function davcsv(url, callback) {
        d3.text(url, function (text) {
            callback(text && d3.csv.parse(text));
        });
    }
    d3Tests.davcsv = davcsv;

    /**
    sto new
    example from http://bl.ocks.org/rkirsling/5001347
    */
    function stickyEditor() {
        // set up SVG for D3
        var width = 960, height = 500, colors = d3.scale.category10();

        var svg = d3.select('body').append('svg').attr('width', width).attr('height', height);

        // set up initial nodes and links
        //  - nodes are known by 'id', not by index in array.
        //  - reflexive edges are indicated on the node (as a bold black circle).
        //  - links are always source < target; edge directions are set by 'left' and 'right'.
        var nodes = [
            { id: 0, reflexive: false },
            { id: 1, reflexive: true },
            { id: 2, reflexive: false }
        ], lastNodeId = 2, links = [
            { source: nodes[0], target: nodes[1], left: false, right: true },
            { source: nodes[1], target: nodes[2], left: false, right: true }
        ];

        // init D3 force layout
        var force = d3.layout.force().nodes(nodes).links(links).size([width, height]).linkDistance(150).charge(-500).on('tick', tick);

        // define arrow markers for graph links
        var arrows = [];

        // no arrow
        arrows.push(svg.append('svg:defs').append('svg:marker').attr('id', 'arrow-0').attr('viewBox', '0 -5 10 10').attr('refX', 6).attr('markerWidth', 3).attr('markerHeight', 3).attr('orient', 'auto'));

        // single arrow
        // define arrow markers for graph links
        arrows.push(svg.append('svg:defs').append('svg:marker').attr('id', 'arrow-1').attr('viewBox', '0 -5 10 10').attr('refX', 6).attr('markerWidth', 3).attr('markerHeight', 3).attr('orient', 'auto').append('svg:path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#000'));

        // double arrow
        arrows.push(svg.append('svg:defs').append('svg:marker'));

        arrows[2].attr('id', 'arrow-2').attr('viewBox', '0 -5 20 20').attr('refX', 17).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto').append('svg:path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#000');

        arrows[2].append('svg:path').attr('d', 'M10,-5L20,0L10,5').attr('fill', '#000');

        // line displayed when dragging new nodes
        var drag_line = svg.append('svg:path').attr('class', 'link dragline hidden').attr('d', 'M0,0L0,0');

        // handles to link and node element groups
        var path = svg.append('svg:g').selectAll('path'), circle = svg.append('svg:g').selectAll('g');

        // mouse event vars
        var selected_node = null, selected_link = null, mousedown_link = null, mousedown_node = null, mouseup_node = null;

        function resetMouseVars() {
            mousedown_node = null;
            mouseup_node = null;
            mousedown_link = null;
        }

        // update force layout (called automatically each iteration)
        function tick() {
            // draw directed edges with proper padding from node centers
            path.attr('d', function (d) {
                var deltaX = d.target.x - d.source.x, deltaY = d.target.y - d.source.y, dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY), normX = deltaX / dist, normY = deltaY / dist, sourcePadding = d.left ? 17 : 12, targetPadding = d.right ? 17 : 12, sourceX = d.source.x + (sourcePadding * normX), sourceY = d.source.y + (sourcePadding * normY), targetX = d.target.x - (targetPadding * normX), targetY = d.target.y - (targetPadding * normY);
                return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
            });

            circle.attr('transform', function (d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            });
        }

        // update graph (called when needed)
        function restart() {
            // path (link) group
            path = path.data(links);

            // update existing links
            path.classed('selected', function (d) {
                return d === selected_link;
            }).style('marker-end', function (d) {
                return 'url(#arrow-1)';
            });

            // add new links
            path.enter().append('svg:path').attr('class', 'link').classed('selected', function (d) {
                return d === selected_link;
            }).style('marker-end', function (d) {
                return 'url(#arrow-1)';
            }).on('mousedown', function (d) {
                if (d3.event.ctrlKey)
                    return;

                // select link
                mousedown_link = d;
                if (mousedown_link === selected_link)
                    selected_link = null;
else
                    selected_link = mousedown_link;
                selected_node = null;
                restart();
            });

            // remove old links
            path.exit().remove();

            // circle (node) group
            // NB: the function arg is crucial here! nodes are known by id, not by index!
            circle = circle.data(nodes, function (d) {
                return d.id;
            });

            // update existing nodes (reflexive & selected visual states)
            circle.selectAll('circle').style('fill', function (d) {
                return (d === selected_node) ? d3.rgb(colors(d.id)).brighter().toString() : colors(d.id);
            }).classed('reflexive', function (d) {
                return d.reflexive;
            });

            // add new nodes
            var g = circle.enter().append('svg:g');

            g.append('svg:circle').attr('class', 'node').attr('r', 12).style('fill', function (d) {
                return (d === selected_node) ? d3.rgb(colors(d.id)).brighter().toString() : colors(d.id);
            }).style('stroke', function (d) {
                return d3.rgb(colors(d.id)).darker().toString();
            }).classed('reflexive', function (d) {
                return d.reflexive;
            }).on('mouseover', function (d) {
                if (!mousedown_node || d === mousedown_node)
                    return;

                // enlarge target node
                d3.select(this).attr('transform', 'scale(1.1)');
            }).on('mouseout', function (d) {
                if (!mousedown_node || d === mousedown_node)
                    return;

                // unenlarge target node
                d3.select(this).attr('transform', '');
            }).on('mousedown', function (d) {
                if (d3.event.ctrlKey)
                    return;

                // select node
                mousedown_node = d;
                if (mousedown_node === selected_node)
                    selected_node = null;
else
                    selected_node = mousedown_node;
                selected_link = null;

                // reposition drag line
                drag_line.style('marker-end', 'url(#arrow-1)').classed('hidden', false).attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + mousedown_node.x + ',' + mousedown_node.y);

                restart();
            }).on('mouseup', function (d) {
                if (!mousedown_node)
                    return;

                // needed by FF
                drag_line.classed('hidden', true).style('marker-end', '');

                // check for drag-to-self
                mouseup_node = d;
                if (mouseup_node === mousedown_node) {
                    resetMouseVars();
                    return;
                }

                // unenlarge target node
                d3.select(this).attr('transform', '');

                // add link to graph (update if exists)
                // NB: links are strictly source < target; arrows separately specified by booleans
                var source, target, direction;
                if (mousedown_node.id < mouseup_node.id) {
                    source = mousedown_node;
                    target = mouseup_node;
                    direction = 'right';
                } else {
                    source = mouseup_node;
                    target = mousedown_node;
                    direction = 'left';
                }

                var link;
                link = links.filter(function (l) {
                    return (l.source === source && l.target === target);
                })[0];

                if (link) {
                    link[direction] = true;
                } else {
                    link = { source: source, target: target, left: false, right: false };
                    link[direction] = true;
                    links.push(link);
                }

                // select new link
                selected_link = link;
                selected_node = null;
                restart();
            });

            // show node IDs
            g.append('svg:text').attr('x', 0).attr('y', 4).attr('class', 'id').text(function (d) {
                return d.id;
            });

            // remove old nodes
            circle.exit().remove();

            // set the graph in motion
            force.start();
        }

        function mousedown() {
            // prevent I-bar on drag
            //d3.event.preventDefault();
            // because :active only works in WebKit?
            svg.classed('active', true);

            if (d3.event.ctrlKey || mousedown_node || mousedown_link)
                return;

            // insert new node at point
            var point = d3.mouse(this), node = { id: ++lastNodeId, reflexive: false };
            node.x = point[0];
            node.y = point[1];
            nodes.push(node);

            restart();
        }

        function mousemove() {
            if (!mousedown_node)
                return;

            // update drag line
            drag_line.attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);

            restart();
        }

        function mouseup() {
            if (mousedown_node) {
                // hide drag line
                drag_line.classed('hidden', true).style('marker-end', '');
            }

            // because :active only works in WebKit?
            svg.classed('active', false);

            // clear mouse event vars
            resetMouseVars();
        }

        function spliceLinksForNode(node) {
            var toSplice = links.filter(function (l) {
                return (l.source === node || l.target === node);
            });
            toSplice.map(function (l) {
                links.splice(links.indexOf(l), 1);
            });
        }

        // only respond once per keydown
        var lastKeyDown = -1;

        function keydown() {
            d3.event.preventDefault();

            if (lastKeyDown !== -1)
                return;
            lastKeyDown = d3.event.keyCode;

            if (d3.event.keyCode === 17) {
                circle.call(force.drag);
                svg.classed('ctrl', true);
            }

            if (!selected_node && !selected_link)
                return;
            switch (d3.event.keyCode) {
                case 8:
                case 46:
                    if (selected_node) {
                        nodes.splice(nodes.indexOf(selected_node), 1);
                        spliceLinksForNode(selected_node);
                    } else if (selected_link) {
                        links.splice(links.indexOf(selected_link), 1);
                    }
                    selected_link = null;
                    selected_node = null;
                    restart();
                    break;
                case 66:
                    if (selected_link) {
                        // set link direction to both left and right
                        selected_link.left = true;
                        selected_link.right = true;
                    }
                    restart();
                    break;
                case 76:
                    if (selected_link) {
                        // set link direction to left only
                        selected_link.left = true;
                        selected_link.right = false;
                    }
                    restart();
                    break;
                case 82:
                    if (selected_node) {
                        // toggle node reflexivity
                        selected_node.reflexive = !selected_node.reflexive;
                    } else if (selected_link) {
                        // set link direction to right only
                        selected_link.left = false;
                        selected_link.right = true;
                    }
                    restart();
                    break;
            }
        }

        function keyup() {
            lastKeyDown = -1;

            if (d3.event.keyCode === 17) {
                circle.on('mousedown.drag', null).on('touchstart.drag', null);
                svg.classed('ctrl', false);
            }
        }

        // app starts here
        svg.on('mousedown', mousedown).on('mousemove', mousemove).on('mouseup', mouseup);
        d3.select(window).on('keydown', keydown).on('keyup', keyup);
        restart();
    }
    d3Tests.stickyEditor = stickyEditor;

    /**
    sto new
    example from http://bl.ocks.org/mbostock/3750558
    */
    function stickyForce() {
        var width = 960, height = 500;

        var force = d3.layout.force().size([width, height]).charge(-400).linkDistance(40).on("tick", tick);

        function dragstart(d) {
            d.fixed = true;
            d3.select(this).classed("fixed", true);
        }

        var drag = force.drag().on("dragstart", dragstart);

        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height);

        var link = svg.selectAll(".link"), node = svg.selectAll(".node");

        var graph = {
            "nodes": [
                { "x": 469, "y": 410 },
                { "x": 493, "y": 364 },
                { "x": 442, "y": 365 },
                { "x": 467, "y": 314 },
                { "x": 477, "y": 248 },
                { "x": 425, "y": 207 },
                { "x": 402, "y": 155 },
                { "x": 369, "y": 196 },
                { "x": 350, "y": 148 },
                { "x": 539, "y": 222 },
                { "x": 594, "y": 235 },
                { "x": 582, "y": 185 },
                { "x": 633, "y": 200 }
            ],
            "links": [
                { "source": 0, "target": 1 },
                { "source": 1, "target": 2 },
                { "source": 2, "target": 0 },
                { "source": 1, "target": 3 },
                { "source": 3, "target": 2 },
                { "source": 3, "target": 4 },
                { "source": 4, "target": 5 },
                { "source": 5, "target": 6 },
                { "source": 5, "target": 7 },
                { "source": 6, "target": 7 },
                { "source": 6, "target": 8 },
                { "source": 7, "target": 8 },
                { "source": 9, "target": 4 },
                { "source": 9, "target": 11 },
                { "source": 9, "target": 10 },
                { "source": 10, "target": 11 },
                { "source": 11, "target": 12 },
                { "source": 12, "target": 10 }
            ]
        };

        force.nodes(graph.nodes).links(graph.links).start();

        link = link.data(graph.links).enter().append("line").attr("class", "link");

        node = node.data(graph.nodes).enter().append("circle").attr("class", "node").attr("r", 12).call(drag);

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
    }
    d3Tests.stickyForce = stickyForce;

    //Example from http://bl.ocks.org/3887235
    function testPieChart() {
        var width = 960, height = 500, radius = Math.min(width, height) / 2;

        var color = d3.scale.ordinal().range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

        var arc = d3.svg.arc().outerRadius(radius - 10).innerRadius(0);

        var pie = d3.layout.pie().sort(null).value(function (d) {
            return d.population;
        });

        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height).append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        davcsv("data.csv", function (data, error) {
            if (error) {
                alert("could not open csv");
                console.log("error: ", error);
            }

            console.log("data = ", data);
            data.forEach(function (d) {
                d.population = +d.population;
            });

            var g = svg.selectAll(".arc").data(pie(data)).enter().append("g").attr("class", "arc");

            g.append("path").attr("d", arc).style("fill", function (d) {
                return color(d.data.age);
            });

            g.append("text").attr("transform", function (d) {
                return "translate(" + arc.centroid(d) + ")";
            }).attr("dy", ".35em").style("text-anchor", "middle").text(function (d) {
                return d.data.age;
            });
        });
    }
    d3Tests.testPieChart = testPieChart;

    //Example from http://bl.ocks.org/3887051
    function groupedBarChart() {
        var margin = { top: 20, right: 20, bottom: 30, left: 40 }, width = 960 - margin.left - margin.right, height = 500 - margin.top - margin.bottom;

        var x0 = d3.scale.ordinal().rangeRoundBands([0, width], .1);

        var x1 = d3.scale.ordinal();

        var y = d3.scale.linear().range([height, 0]);

        var color = d3.scale.ordinal().range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

        var xAxis = d3.svg.axis().scale(x0).orient("bottom");

        var yAxis = d3.svg.axis().scale(y).orient("left").tickFormat(d3.format(".2s"));

        var svg = d3.select("body").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        d3.csv("data.csv", function (error, data) {
            var ageNames = d3.keys(data[0]).filter(function (key) {
                return key !== "State";
            });

            data.forEach(function (d) {
                d.ages = ageNames.map(function (name) {
                    return { name: name, value: +d[name] };
                });
            });

            x0.domain(data.map(function (d) {
                return d.State;
            }));
            x1.domain(ageNames).rangeRoundBands([0, x0.rangeBand()]);
            y.domain([0, d3.max(data, function (d) {
                    return d3.max(d.ages, function (d) {
                        return d.value;
                    });
                })]);

            svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxis);

            svg.append("g").attr("class", "y axis").call(yAxis).append("text").attr("transform", "rotate(-90)").attr("y", 6).attr("dy", ".71em").style("text-anchor", "end").text("Population");

            var state = svg.selectAll(".state").data(data).enter().append("g").attr("class", "g").attr("transform", function (d) {
                return "translate(" + x0(d.State) + ",0)";
            });

            state.selectAll("rect").data(function (d) {
                return d.ages;
            }).enter().append("rect").attr("width", x1.rangeBand()).attr("x", function (d) {
                return x1(d.name);
            }).attr("y", function (d) {
                return y(d.value);
            }).attr("height", function (d) {
                return height - y(d.value);
            }).style("fill", function (d) {
                return color(d.name);
            });

            var legend = svg.selectAll(".legend").data(ageNames.reverse()).enter().append("g").attr("class", "legend").attr("transform", function (d, i) {
                return "translate(0," + i * 20 + ")";
            });

            legend.append("rect").attr("x", width - 18).attr("width", 18).attr("height", 18).style("fill", color);

            legend.append("text").attr("x", width - 24).attr("y", 9).attr("dy", ".35em").style("text-anchor", "end").text(function (d) {
                return d;
            });
        });
    }

    //Example from http://bl.ocks.org/3886208
    function stackedBarChart() {
        var margin = { top: 20, right: 20, bottom: 30, left: 40 }, width = 960 - margin.left - margin.right, height = 500 - margin.top - margin.bottom;

        var x = d3.scale.ordinal().rangeRoundBands([0, width], .1);

        var y = d3.scale.linear().rangeRound([height, 0]);

        var color = d3.scale.ordinal().range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

        var xAxis = d3.svg.axis().scale(x).orient("bottom");

        var yAxis = d3.svg.axis().scale(y).orient("left").tickFormat(d3.format(".2s"));

        var svg = d3.select("body").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        d3.csv("data.csv", function (error, data) {
            color.domain(d3.keys(data[0]).filter(function (key) {
                return key !== "State";
            }));

            data.forEach(function (d) {
                var y0 = 0;
                d.ages = color.domain().map(function (name) {
                    return { name: name, y0: y0, y1: y0 += +d[name] };
                });
                d.total = d.ages[d.ages.length - 1].y1;
            });

            data.sort(function (a, b) {
                return b.total - a.total;
            });

            x.domain(data.map(function (d) {
                return d.State;
            }));
            y.domain([0, d3.max(data, function (d) {
                    return d.total;
                })]);

            svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxis);

            svg.append("g").attr("class", "y axis").call(yAxis).append("text").attr("transform", "rotate(-90)").attr("y", 6).attr("dy", ".71em").style("text-anchor", "end").text("Population");

            var state = svg.selectAll(".state").data(data).enter().append("g").attr("class", "g").attr("transform", function (d) {
                return "translate(" + x(d.State) + ",0)";
            });

            state.selectAll("rect").data(function (d) {
                return d.ages;
            }).enter().append("rect").attr("width", x.rangeBand()).attr("y", function (d) {
                return y(d.y1);
            }).attr("height", function (d) {
                return y(d.y0) - y(d.y1);
            }).style("fill", function (d) {
                return color(d.name);
            });

            var legend = svg.selectAll(".legend").data(color.domain().reverse()).enter().append("g").attr("class", "legend").attr("transform", function (d, i) {
                return "translate(0," + i * 20 + ")";
            });

            legend.append("rect").attr("x", width - 18).attr("width", 18).attr("height", 18).style("fill", color);

            legend.append("text").attr("x", width - 24).attr("y", 9).attr("dy", ".35em").style("text-anchor", "end").text(function (d) {
                return d;
            });
        });
    }

    // example from http://bl.ocks.org/3886394
    function normalizedBarChart() {
        var margin = { top: 20, right: 100, bottom: 30, left: 40 }, width = 960 - margin.left - margin.right, height = 500 - margin.top - margin.bottom;

        var x = d3.scale.ordinal().rangeRoundBands([0, width], .1);

        var y = d3.scale.linear().rangeRound([height, 0]);

        var color = d3.scale.ordinal().range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

        var xAxis = d3.svg.axis().scale(x).orient("bottom");

        var yAxis = d3.svg.axis().scale(y).orient("left").tickFormat(d3.format(".0%"));

        var svg = d3.select("body").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        d3.csv("data.csv", function (error, data) {
            color.domain(d3.keys(data[0]).filter(function (key) {
                return key !== "State";
            }));

            data.forEach(function (d) {
                var y0 = 0;
                d.ages = color.domain().map(function (name) {
                    return { name: name, y0: y0, y1: y0 += +d[name] };
                });
                d.ages.forEach(function (d) {
                    d.y0 /= y0;
                    d.y1 /= y0;
                });
            });

            data.sort(function (a, b) {
                return b.ages[0].y1 - a.ages[0].y1;
            });

            x.domain(data.map(function (d) {
                return d.State;
            }));

            svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxis);

            svg.append("g").attr("class", "y axis").call(yAxis);

            var state = svg.selectAll(".state").data(data).enter().append("g").attr("class", "state").attr("transform", function (d) {
                return "translate(" + x(d.State) + ",0)";
            });

            state.selectAll("rect").data(function (d) {
                return d.ages;
            }).enter().append("rect").attr("width", x.rangeBand()).attr("y", function (d) {
                return y(d.y1);
            }).attr("height", function (d) {
                return y(d.y0) - y(d.y1);
            }).style("fill", function (d) {
                return color(d.name);
            });

            var legend = svg.select(".state:last-child").selectAll(".legend").data(function (d) {
                return d.ages;
            }).enter().append("g").attr("class", "legend").attr("transform", function (d) {
                return "translate(" + x.rangeBand() / 2 + "," + y((d.y0 + d.y1) / 2) + ")";
            });

            legend.append("line").attr("x2", 10);

            legend.append("text").attr("x", 13).attr("dy", ".35em").text(function (d) {
                return d.name;
            });
        });
    }

    // example from http://bl.ocks.org/3885705
    function sortablebarChart() {
        var margin = { top: 20, right: 20, bottom: 30, left: 40 }, width = 960 - margin.left - margin.right, height = 500 - margin.top - margin.bottom;

        var formatPercent = d3.format(".0%");

        var x = d3.scale.ordinal().rangeRoundBands([0, width], .1, 1);

        var y = d3.scale.linear().range([height, 0]);

        var xAxis = d3.svg.axis().scale(x).orient("bottom");

        var yAxis = d3.svg.axis().scale(y).orient("left").tickFormat(formatPercent);

        var svg = d3.select("body").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        d3.tsv("data.tsv", function (error, data) {
            data.forEach(function (d) {
                d.frequency = +d.frequency;
            });

            x.domain(data.map(function (d) {
                return d.letter;
            }));
            y.domain([0, d3.max(data, function (d) {
                    return d.frequency;
                })]);

            svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxis);

            svg.append("g").attr("class", "y axis").call(yAxis).append("text").attr("transform", "rotate(-90)").attr("y", 6).attr("dy", ".71em").style("text-anchor", "end").text("Frequency");

            svg.selectAll(".bar").data(data).enter().append("rect").attr("class", "bar").attr("x", function (d) {
                return x(d.letter);
            }).attr("width", x.rangeBand()).attr("y", function (d) {
                return y(d.frequency);
            }).attr("height", function (d) {
                return height - y(d.frequency);
            });

            d3.select("input").on("change", change);

            var sortTimeout = setTimeout(function () {
                d3.select("input").property("checked", true).each(change);
            }, 2000);

            function change() {
                clearTimeout(sortTimeout);

                var x0 = x.domain(data.sort(this.checked ? function (a, b) {
                    return b.frequency - a.frequency;
                } : function (a, b) {
                    return d3.ascending(a.letter, b.letter);
                }).map(function (d) {
                    return d.letter;
                })).copy();

                var transition = svg.transition().duration(750), delay = function (d, i) {
                    return i * 50;
                };

                transition.selectAll(".bar").delay(delay).attr("x", function (d) {
                    return x0(d.letter);
                });

                transition.select(".x.axis").call(xAxis).selectAll("g").delay(delay);
            }
        });
    }

    //example from http://bl.ocks.org/4063318
    function callenderView() {
        var width = 960, height = 136, cellSize = 17;

        var day = d3.time.format("%w"), week = d3.time.format("%U"), percent = d3.format(".1%"), format = d3.time.format("%Y-%m-%d");

        var color = d3.scale.quantize().domain([-.05, .05]).range(d3.range(11).map(function (d) {
            return "q" + d + "-11";
        }));

        var svg = d3.select("body").selectAll("svg").data(d3.range(1990, 2011)).enter().append("svg").attr("width", width).attr("height", height).attr("class", "RdYlGn").append("g").attr("transform", "translate(" + ((width - cellSize * 53) / 2) + "," + (height - cellSize * 7 - 1) + ")");

        svg.append("text").attr("transform", "translate(-6," + cellSize * 3.5 + ")rotate(-90)").style("text-anchor", "middle").text(function (d) {
            return d;
        });

        var rect = svg.selectAll(".day").data(function (d) {
            return d3.time.days(new Date(d, 0, 1), new Date(d + 1, 0, 1));
        }).enter().append("rect").attr("class", "day").attr("width", cellSize).attr("height", cellSize).attr("x", function (d) {
            return parseInt(week(d)) * cellSize;
        }).attr("y", function (d) {
            return parseInt(day(d)) * cellSize;
        }).datum(format);

        rect.append("title").text(function (d) {
            return d;
        });

        svg.selectAll(".month").data(function (d) {
            return d3.time.months(new Date(d, 0, 1), new Date(d + 1, 0, 1));
        }).enter().append("path").attr("class", "month").attr("d", monthPath);

        d3.csv("dji.csv", function (error, csv) {
            var data = d3.nest().key(function (d) {
                return d.Date;
            }).rollup(function (d) {
                return (d[0].Close - d[0].Open) / d[0].Open;
            }).map(csv);

            rect.filter(function (d) {
                return d in data;
            }).attr("class", function (d) {
                return "day " + color(data[d]);
            }).select("title").text(function (d) {
                return d + ": " + percent(data[d]);
            });
        });

        function monthPath(t0) {
            var t1 = new Date(t0.getFullYear(), t0.getMonth() + 1, 0), d0 = +day(t0), w0 = +week(t0), d1 = +day(t1), w1 = +week(t1);
            return "M" + (w0 + 1) * cellSize + "," + d0 * cellSize + "H" + w0 * cellSize + "V" + 7 * cellSize + "H" + w1 * cellSize + "V" + (d1 + 1) * cellSize + "H" + (w1 + 1) * cellSize + "V" + 0 + "H" + (w0 + 1) * cellSize + "Z";
        }

        d3.select(self.frameElement).style("height", "2910px");
    }

    // example from http://bl.ocks.org/3883245
    function lineChart() {
        var margin = { top: 20, right: 20, bottom: 30, left: 50 }, width = 960 - margin.left - margin.right, height = 500 - margin.top - margin.bottom;

        var parseDate = d3.time.format("%d-%b-%y").parse;

        var x = d3.time.scale().range([0, width]);

        var y = d3.scale.linear().range([height, 0]);

        var xAxis = d3.svg.axis().scale(x).orient("bottom");

        var yAxis = d3.svg.axis().scale(y).orient("left");

        var line = d3.svg.line().x(function (d) {
            return x(d.date);
        }).y(function (d) {
            return y(d.close);
        });

        var svg = d3.select("body").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        d3.tsv("data.tsv", function (error, data) {
            data.forEach(function (d) {
                d.date = parseDate(d.date);
                d.close = +d.close;
            });

            x.domain(d3.extent(data, function (d) {
                return d.date;
            }));
            y.domain(d3.extent(data, function (d) {
                return d.close;
            }));

            svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxis);

            svg.append("g").attr("class", "y axis").call(yAxis).append("text").attr("transform", "rotate(-90)").attr("y", 6).attr("dy", ".71em").style("text-anchor", "end").text("Price ($)");

            svg.append("path").datum(data).attr("class", "line").attr("d", line);
        });
    }

    //example from http://bl.ocks.org/3884914
    function bivariateAreaChart() {
        var margin = { top: 20, right: 20, bottom: 30, left: 50 }, width = 960 - margin.left - margin.right, height = 500 - margin.top - margin.bottom;

        var parseDate = d3.time.format("%Y%m%d").parse;

        var x = d3.time.scale().range([0, width]);

        var y = d3.scale.linear().range([height, 0]);

        var xAxis = d3.svg.axis().scale(x).orient("bottom");

        var yAxis = d3.svg.axis().scale(y).orient("left");

        var area = d3.svg.area().x(function (d) {
            return x(d.date);
        }).y0(function (d) {
            return y(d.low);
        }).y1(function (d) {
            return y(d.high);
        });

        var svg = d3.select("body").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        d3.tsv("data.tsv", function (error, data) {
            data.forEach(function (d) {
                d.date = parseDate(d.date);
                d.low = +d.low;
                d.high = +d.high;
            });

            x.domain(d3.extent(data, function (d) {
                return d.date;
            }));
            y.domain([d3.min(data, function (d) {
                    return d.low;
                }), d3.max(data, function (d) {
                    return d.high;
                })]);

            svg.append("path").datum(data).attr("class", "area").attr("d", area);

            svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxis);

            svg.append("g").attr("class", "y axis").call(yAxis).append("text").attr("transform", "rotate(-90)").attr("y", 6).attr("dy", ".71em").style("text-anchor", "end").text("Temperature (ºF)");
        });
    }

    //Example from http://bl.ocks.org/mbostock/1557377
    function dragMultiples() {
        var width = 238, height = 123, radius = 20;

        var drag = d3.behavior.drag().origin(Object).on("drag", dragmove);

        var svg = d3.select("body").selectAll("svg").data(d3.range(16).map(function () {
            return { x: width / 2, y: height / 2 };
        })).enter().append("svg").attr("width", width).attr("height", height);

        svg.append("circle").attr("r", radius).attr("cx", function (d) {
            return d.x;
        }).attr("cy", function (d) {
            return d.y;
        }).call(drag);

        function dragmove(d) {
            d3.select(this).attr("cx", d.x = Math.max(radius, Math.min(width - radius, d3.event.x))).attr("cy", d.y = Math.max(radius, Math.min(height - radius, d3.event.y)));
        }
    }

    //Example from http://bl.ocks.org/mbostock/3892919
    function panAndZoom() {
        var margin = { top: 20, right: 20, bottom: 30, left: 40 }, width = 960 - margin.left - margin.right, height = 500 - margin.top - margin.bottom;

        var x = d3.scale.linear().domain([-width / 2, width / 2]).range([0, width]);

        var y = d3.scale.linear().domain([-height / 2, height / 2]).range([height, 0]);

        var xAxis = d3.svg.axis().scale(x).orient("bottom").tickSize(-height);

        var yAxis = d3.svg.axis().scale(y).orient("left").ticks(5).tickSize(-width);

        var zoom = d3.behavior.zoom().x(x).y(y).scaleExtent([1, 10]).on("zoom", zoomed);

        var svg = d3.select("body").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")").call(zoom);

        svg.append("rect").attr("width", width).attr("height", height);

        svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxis);

        svg.append("g").attr("class", "y axis").call(yAxis);

        function zoomed() {
            svg.select(".x.axis").call(xAxis);
            svg.select(".y.axis").call(yAxis);
        }
    }

    //Example from http://bl.ocks.org/mbostock/1125997
    function chainedTransitions() {
        var w = 960, h = 500, y = d3.scale.ordinal().domain(d3.range(50)).rangePoints([20, h - 20]), t = Date.now();

        var svg = d3.select("body").append("svg:svg").attr("width", w).attr("height", h);

        var circle = svg.selectAll("circle").data(y.domain()).enter().append("svg:circle").attr("r", 16).attr("cx", 20).attr("cy", y).each(slide(20, w - 20));

        function slide(x0, x1) {
            t += 50;
            return function () {
                d3.select(this).transition().duration(t - Date.now()).attr("cx", x1).each("end", slide(x1, x0));
            };
        }
    }

    //Example from http://bl.ocks.org/mbostock/4062085
    function populationPyramid() {
        var margin = { top: 20, right: 40, bottom: 30, left: 20 }, width = 960 - margin.left - margin.right, height = 500 - margin.top - margin.bottom, barWidth = Math.floor(width / 19) - 1;

        var x = d3.scale.linear().range([barWidth / 2, width - barWidth / 2]);

        var y = d3.scale.linear().range([height, 0]);

        var yAxis = d3.svg.axis().scale(y).orient("right").tickSize(-width).tickFormat(function (d) {
            return Math.round(d / 1e6) + "M";
        });

        // An SVG element with a bottom-right origin.
        var svg = d3.select("body").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // A sliding container to hold the bars by birthyear.
        var birthyears = svg.append("g").attr("class", "birthyears");

        // A label for the current year.
        var title = svg.append("text").attr("class", "title").attr("dy", ".71em").text(2000);

        d3.csv("population.csv", function (error, data) {
            // Convert strings to numbers.
            data.forEach(function (d) {
                d.people = +d.people;
                d.year = +d.year;
                d.age = +d.age;
            });

            // Compute the extent of the data set in age and years.
            var age1 = d3.max(data, function (d) {
                return d.age;
            }), year0 = d3.min(data, function (d) {
                return d.year;
            }), year1 = d3.max(data, function (d) {
                return d.year;
            }), year = year1;

            // Update the scale domains.
            x.domain([year1 - age1, year1]);
            y.domain([0, d3.max(data, function (d) {
                    return d.people;
                })]);

            // Produce a map from year and birthyear to [male, female].
            data = d3.nest().key(function (d) {
                return d.year;
            }).key(function (d) {
                return '' + (d.year - d.age);
            }).rollup(function (v) {
                return v.map(function (d) {
                    return d.people;
                });
            }).map(data);

            // Add an axis to show the population values.
            svg.append("g").attr("class", "y axis").attr("transform", "translate(" + width + ",0)").call(yAxis).selectAll("g").filter(function (value) {
                return !value;
            }).classed("zero", true);

            // Add labeled rects for each birthyear (so that no enter or exit is required).
            var birthyear = birthyears.selectAll(".birthyear").data(d3.range(year0 - age1, year1 + 1, 5)).enter().append("g").attr("class", "birthyear").attr("transform", function (birthyear) {
                return "translate(" + x(birthyear) + ",0)";
            });

            birthyear.selectAll("rect").data(function (birthyear) {
                return data[year][birthyear] || [0, 0];
            }).enter().append("rect").attr("x", -barWidth / 2).attr("width", barWidth).attr("y", y).attr("height", function (value) {
                return height - y(value);
            });

            // Add labels to show birthyear.
            birthyear.append("text").attr("y", height - 4).text(function (birthyear) {
                return birthyear;
            });

            // Add labels to show age (separate; not animated).
            svg.selectAll(".age").data(d3.range(0, age1 + 1, 5)).enter().append("text").attr("class", "age").attr("x", function (age) {
                return x(year - age);
            }).attr("y", height + 4).attr("dy", ".71em").text(function (age) {
                return age;
            });

            // Allow the arrow keys to change the displayed year.
            window.focus();
            d3.select(window).on("keydown", function () {
                switch (d3.event.keyCode) {
                    case 37:
                        year = Math.max(year0, year - 10);
                        break;
                    case 39:
                        year = Math.min(year1, year + 10);
                        break;
                }
                update();
            });

            function update() {
                if (!(year in data))
                    return;
                title.text(year);

                birthyears.transition().duration(750).attr("transform", "translate(" + (x(year1) - x(year)) + ",0)");

                birthyear.selectAll("rect").data(function (birthyear) {
                    return data[year][birthyear] || [0, 0];
                }).transition().duration(750).attr("y", y).attr("height", function (value) {
                    return height - y(value);
                });
            }
        });
    }

    //Example from http://bl.ocks.org/MoritzStefaner/1377729
    function forcedBasedLabelPlacemant() {
        var w = 960, h = 500;

        var labelDistance = 0;

        var vis = d3.select("body").append("svg:svg").attr("width", w).attr("height", h);

        var nodes = [];
        var labelAnchors = [];
        var labelAnchorLinks = [];
        var links = [];

        for (var i = 0; i < 30; i++) {
            var nodeLabel = {
                label: "node " + i
            };
            nodes.push(nodeLabel);
            labelAnchors.push({
                node: nodeLabel
            });
            labelAnchors.push({
                node: nodeLabel
            });
        }
        ;

        for (var i = 0; i < nodes.length; i++) {
            for (var j = 0; j < i; j++) {
                if (Math.random() > .95)
                    links.push({
                        source: i,
                        target: j,
                        weight: Math.random()
                    });
            }
            labelAnchorLinks.push({
                source: i * 2,
                target: i * 2 + 1,
                weight: 1
            });
        }
        ;

        var force = d3.layout.force().size([w, h]).nodes(nodes).links(links).gravity(1).linkDistance(50).charge(-3000).linkStrength(function (x) {
            return x.weight * 10;
        });

        force.start();

        var force2 = d3.layout.force().nodes(labelAnchors).links(labelAnchorLinks).gravity(0).linkDistance(0).linkStrength(8).charge(-100).size([w, h]);
        force2.start();

        var link = vis.selectAll("line.link").data(links).enter().append("svg:line").attr("class", "link").style("stroke", "#CCC");

        var node = vis.selectAll("g.node").data(force.nodes()).enter().append("svg:g").attr("class", "node");
        node.append("svg:circle").attr("r", 5).style("fill", "#555").style("stroke", "#FFF").style("stroke-width", 3);
        node.call(force.drag);

        var anchorLink = vis.selectAll("line.anchorLink").data(labelAnchorLinks);

        var anchorNode = vis.selectAll("g.anchorNode").data(force2.nodes()).enter().append("svg:g").attr("class", "anchorNode");
        anchorNode.append("svg:circle").attr("r", 0).style("fill", "#FFF");
        anchorNode.append("svg:text").text(function (d, i) {
            return i % 2 == 0 ? "" : d.node.label;
        }).style("fill", "#555").style("font-family", "Arial").style("font-size", 12);

        var updateLink = function () {
            this.attr("x1", function (d) {
                return d.source.x;
            }).attr("y1", function (d) {
                return d.source.y;
            }).attr("x2", function (d) {
                return d.target.x;
            }).attr("y2", function (d) {
                return d.target.y;
            });
        };

        var updateNode = function () {
            this.attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            });
        };

        force.on("tick", function () {
            force2.start();

            node.call(updateNode);

            anchorNode.each(function (d, i) {
                if (i % 2 == 0) {
                    d.x = d.node.x;
                    d.y = d.node.y;
                } else {
                    var b = this.childNodes[1].getBBox();

                    var diffX = d.x - d.node.x;
                    var diffY = d.y - d.node.y;

                    var dist = Math.sqrt(diffX * diffX + diffY * diffY);

                    var shiftX = b.width * (diffX - dist) / (dist * 2);
                    shiftX = Math.max(-b.width, Math.min(0, shiftX));
                    var shiftY = 5;
                    this.childNodes[1].setAttribute("transform", "translate(" + shiftX + "," + shiftY + ")");
                }
            });

            anchorNode.call(updateNode);

            link.call(updateLink);
            anchorLink.call(updateLink);
        });
    }

    //Example from http://bl.ocks.org/mbostock/1125997
    function forceCollapsable() {
        var w = 1280, h = 800, node, link, root;

        var force = d3.layout.force().on("tick", tick).charge(function (d) {
            return d._children ? -d.size / 100 : -30;
        }).linkDistance(function (d) {
            return d.target._children ? 80 : 30;
        }).size([w, h - 160]);

        var vis = d3.select("body").append("svg:svg").attr("width", w).attr("height", h);

        d3.json("flare.json", function (json) {
            root = json;
            root.fixed = true;
            root.x = w / 2;
            root.y = h / 2 - 80;
            update();
        });

        function update() {
            var nodes = flatten(root), links = d3.layout.tree().links(nodes);

            // Restart the force layout.
            force.nodes(nodes).links(links).start();

            // Update the links…
            link = vis.selectAll("line.link").data(links, function (d) {
                return d.target.id;
            });

            // Enter any new links.
            link.enter().insert("svg:line", ".node").attr("class", "link").attr("x1", function (d) {
                return d.source.x;
            }).attr("y1", function (d) {
                return d.source.y;
            }).attr("x2", function (d) {
                return d.target.x;
            }).attr("y2", function (d) {
                return d.target.y;
            });

            // Exit any old links.
            link.exit().remove();

            // Update the nodes…
            node = vis.selectAll("circle.node").data(nodes, function (d) {
                return d.id;
            }).style("fill", color);

            node.transition().attr("r", function (d) {
                return d.children ? 4.5 : Math.sqrt(d.size) / 10;
            });

            // Enter any new nodes.
            node.enter().append("svg:circle").attr("class", "node").attr("cx", function (d) {
                return d.x;
            }).attr("cy", function (d) {
                return d.y;
            }).attr("r", function (d) {
                return d.children ? 4.5 : Math.sqrt(d.size) / 10;
            }).style("fill", color).on("click", click).call(force.drag);

            // Exit any old nodes.
            node.exit().remove();
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

        // Color leaf nodes orange, and packages white or blue.
        function color(d) {
            return d._children ? "#3182bd" : d.children ? "#c6dbef" : "#fd8d3c";
        }

        // Toggle children on click.
        function click(d) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            update();
        }

        // Returns a list of all nodes under the root.
        function flatten(root) {
            var nodes = [], i = 0;

            function recurse(node) {
                if (node.children)
                    node.size = node.children.reduce(function (p, v) {
                        return p + recurse(v);
                    }, 0);
                if (!node.id)
                    node.id = ++i;
                nodes.push(node);
                return node.size;
            }

            root.size = recurse(root);
            return nodes;
        }
    }

    //Example from http://bl.ocks.org/mbostock/3757110
    function azimuthalEquidistant() {
        var width = 960, height = 960;
        var topojson;

        var projection = d3.geo.azimuthalEquidistant().scale(150).translate([width / 2, height / 2]).clipAngle(180 - 1e-3).precision(.1);

        var path = d3.geo.path().projection(projection);

        var graticule = d3.geo.graticule();

        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height);

        svg.append("defs").append("path").datum({ type: "Sphere" }).attr("id", "sphere").attr("d", path);

        svg.append("use").attr("class", "stroke").attr("xlink:href", "#sphere");

        svg.append("use").attr("class", "fill").attr("xlink:href", "#sphere");

        svg.append("path").datum(graticule).attr("class", "graticule").attr("d", path);

        d3.json("/mbostock/raw/4090846/world-50m.json", function (error, world) {
            svg.insert("path", ".graticule").datum(topojson.feature(world, world.objects.land)).attr("class", "land").attr("d", path);

            svg.insert("path", ".graticule").datum(topojson.mesh(world, world.objects.countries, function (a, b) {
                return a !== b;
            })).attr("class", "boundary").attr("d", path);
        });

        d3.select(self.frameElement).style("height", height + "px");
    }

    //Example from http://bl.ocks.org/mbostock/4060366
    function voroniTesselation() {
        var width = 960, height = 500;

        var vertices = d3.range(100).map(function (d) {
            return [Math.random() * width, Math.random() * height];
        });

        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height).attr("class", "PiYG").on("mousemove", function () {
            vertices[0] = d3.mouse(this);
            redraw();
        });

        var path = svg.append("g").selectAll("path");

        svg.selectAll("circle").data(vertices.slice(1)).enter().append("circle").attr("transform", function (d) {
            return "translate(" + d + ")";
        }).attr("r", 2);

        redraw();

        function redraw() {
            path = path.data(d3.geom.voronoi(vertices).map(function (d) {
                return "M" + d.join("L") + "Z";
            }), String);
            path.exit().remove();
            path.enter().append("path").attr("class", function (d, i) {
                return "q" + (i % 9) + "-9";
            }).attr("d", String);
            path.order();
        }
    }

    //Example from http://bl.ocks.org/mbostock/4341156
    function delaunayTesselation() {
        var width = 960, height = 500;

        var vertices = d3.range(100).map(function (d) {
            return [Math.random() * width, Math.random() * height];
        });

        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height).attr("class", "PiYG").on("mousemove", function () {
            vertices[0] = d3.mouse(this);
            redraw();
        });

        var path = svg.append("g").selectAll("path");

        svg.selectAll("circle").data(vertices.slice(1)).enter().append("circle").attr("transform", function (d) {
            return "translate(" + d + ")";
        }).attr("r", 2);

        redraw();

        function redraw() {
            path = path.data(d3.geom.delaunay(vertices).map(function (d) {
                return "M" + d.join("L") + "Z";
            }), String);
            path.exit().remove();
            path.enter().append("path").attr("class", function (d, i) {
                return "q" + (i % 9) + "-9";
            }).attr("d", String);
        }
    }

    //Example from http://bl.ocks.org/mbostock/4343214
    function quadtree() {
        var width = 960, height = 500;

        var data = d3.range(5000).map(function () {
            return { x: Math.random() * width, y: Math.random() * width };
        });

        var quadtree = d3.geom.quadtree(data, -1, -1, width + 1, height + 1);

        var brush = d3.svg.brush().x(d3.scale.identity().domain([0, width])).y(d3.scale.identity().domain([0, height])).on("brush", brushed).extent([[100, 100], [200, 200]]);

        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height);

        svg.selectAll(".node").data(nodes(quadtree)).enter().append("rect").attr("class", "node").attr("x", function (d) {
            return d.x;
        }).attr("y", function (d) {
            return d.y;
        }).attr("width", function (d) {
            return d.width;
        }).attr("height", function (d) {
            return d.height;
        });

        var point = svg.selectAll(".point").data(data).enter().append("circle").attr("class", "point").attr("cx", function (d) {
            return d.x;
        }).attr("cy", function (d) {
            return d.y;
        }).attr("r", 4);

        svg.append("g").attr("class", "brush").call(brush);

        brushed();

        function brushed() {
            var extent = brush.extent();
            point.each(function (d) {
                d.scanned = d.selected = false;
            });
            search(quadtree, extent[0][0], extent[0][1], extent[1][0], extent[1][1]);
            point.classed("scanned", function (d) {
                return d.scanned;
            });
            point.classed("selected", function (d) {
                return d.selected;
            });
        }

        // Collapse the quadtree into an array of rectangles.
        function nodes(quadtree) {
            var nodes = [];
            quadtree.visit(function (node, x1, y1, x2, y2) {
                nodes.push({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
            });
            return nodes;
        }

        // Find the nodes within the specified rectangle.
        function search(quadtree, x0, y0, x3, y3) {
            quadtree.visit(function (node, x1, y1, x2, y2) {
                var p = node.point;
                if (p) {
                    p.scanned = true;
                    p.selected = (p.x >= x0) && (p.x < x3) && (p.y >= y0) && (p.y < y3);
                }
                return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
            });
        }
    }

    //Example from http://bl.ocks.org/mbostock/4341699
    function convexHull() {
        var width = 960, height = 500;

        var randomX = d3.random.normal(width / 2, 60), randomY = d3.random.normal(height / 2, 60), vertices = d3.range(100).map(function () {
            return [randomX(), randomY()];
        });

        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height).on("mousemove", function () {
            vertices[0] = d3.mouse(this);
            redraw();
        }).on("click", function () {
            vertices.push(d3.mouse(this));
            redraw();
        });

        svg.append("rect").attr("width", width).attr("height", height);

        var hull = svg.append("path").attr("class", "hull");

        var circle = svg.selectAll("circle");

        redraw();

        function redraw() {
            hull.datum(d3.geom.hull(vertices)).attr("d", function (d) {
                return "M" + d.join("L") + "Z";
            });
            circle = circle.data(vertices);
            circle.enter().append("circle").attr("r", 3);
            circle.attr("transform", function (d) {
                return "translate(" + d + ")";
            });
        }
    }

    // example from http://bl.ocks.org/mbostock/1044242
    function hierarchicalEdgeBundling() {
        var diameter = 960, radius = diameter / 2, innerRadius = radius - 120;

        var cluster = d3.layout.cluster().size([360, innerRadius]).sort(null).value(function (d) {
            return d.size;
        });

        var bundle = d3.layout.bundle();

        var line = d3.svg.line.radial().interpolate("bundle").tension(.85).radius(function (d) {
            return d.y;
        }).angle(function (d) {
            return d.x / 180 * Math.PI;
        });

        var svg = d3.select("body").append("svg").attr("width", diameter).attr("height", diameter).append("g").attr("transform", "translate(" + radius + "," + radius + ")");

        d3.json("readme-flare-imports.json", function (error, classes) {
            var nodes = cluster.nodes(packages.root(classes)), links = packages.imports(nodes);

            svg.selectAll(".link").data(bundle(links)).enter().append("path").attr("class", "link").attr("d", line);

            svg.selectAll(".node").data(nodes.filter(function (n) {
                return !n.children;
            })).enter().append("g").attr("class", "node").attr("transform", function (d) {
                return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")";
            }).append("text").attr("dx", function (d) {
                return d.x < 180 ? 8 : -8;
            }).attr("dy", ".31em").attr("text-anchor", function (d) {
                return d.x < 180 ? "start" : "end";
            }).attr("transform", function (d) {
                return d.x < 180 ? null : "rotate(180)";
            }).text(function (d) {
                return d.key;
            });
        });

        d3.select(self.frameElement).style("height", diameter + "px");

        var packages = {
            // Lazily construct the package hierarchy from class names.
            root: function (classes) {
                var map = {};

                function find(name, data) {
                    var node = map[name], i;
                    if (!node) {
                        node = map[name] = data || { name: name, children: [] };
                        if (name.length) {
                            node.parent = find(name.substring(0, i = name.lastIndexOf(".")));
                            node.parent.children.push(node);
                            node.key = name.substring(i + 1);
                        }
                    }
                    return node;
                }

                classes.forEach(function (d) {
                    find(d.name, d);
                });

                return map[""];
            },
            // Return a list of imports for the given array of nodes.
            imports: function (nodes) {
                var map = {}, imports = [];

                // Compute a map from name to node.
                nodes.forEach(function (d) {
                    map[d.name] = d;
                });

                // For each import, construct a link from the source to target node.
                nodes.forEach(function (d) {
                    if (d.imports)
                        d.imports.forEach(function (i) {
                            imports.push({ source: map[d.name], target: map[i] });
                        });
                });

                return imports;
            }
        };
    }

    // example from http://bl.ocks.org/mbostock/1123639
    function roundedRectangles() {
        var mouse = [480, 250], count = 0;

        var svg = d3.select("body").append("svg:svg").attr("width", 960).attr("height", 500);

        var g = svg.selectAll("g").data(d3.range(25)).enter().append("svg:g").attr("transform", "translate(" + mouse + ")");

        g.append("svg:rect").attr("rx", 6).attr("ry", 6).attr("x", -12.5).attr("y", -12.5).attr("width", 25).attr("height", 25).attr("transform", function (d, i) {
            return "scale(" + (1 - d / 25) * 20 + ")";
        }).style("fill", d3.scale.category20c());

        g.map(function (d) {
            return { center: [0, 0], angle: 0 };
        });

        svg.on("mousemove", function () {
            mouse = d3.mouse(this);
        });

        d3.timer(function () {
            count++;
            g.attr("transform", function (d, i) {
                d.center[0] += (mouse[0] - d.center[0]) / (i + 5);
                d.center[1] += (mouse[1] - d.center[1]) / (i + 5);
                d.angle += Math.sin((count + i) / 10) * 7;
                return "translate(" + d.center + ")rotate(" + d.angle + ")";
            });
            return true;
        });
    }

    // example from http://bl.ocks.org/mbostock/4060954
    function streamGraph() {
        var n = 20, m = 200, stack = d3.layout.stack().offset("wiggle"), layers0 = stack(d3.range(n).map(function () {
            return bumpLayer(m);
        })), layers1 = stack(d3.range(n).map(function () {
            return bumpLayer(m);
        }));

        var width = 960, height = 500;

        var x = d3.scale.linear().domain([0, m - 1]).range([0, width]);

        var y = d3.scale.linear().domain([0, d3.max(layers0.concat(layers1), function (layer) {
                return d3.max(layer, function (d) {
                    return d.y0 + d.y;
                });
            })]).range([height, 0]);

        var color = d3.scale.linear().range(["#aad", "#556"]);

        var area = d3.svg.area().x(function (d) {
            return x(d.x);
        }).y0(function (d) {
            return y(d.y0);
        }).y1(function (d) {
            return y(d.y0 + d.y);
        });

        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height);

        svg.selectAll("path").data(layers0).enter().append("path").attr("d", area).style("fill", function () {
            return color(Math.random());
        });

        function transition() {
            d3.selectAll("path").data(function () {
                var d = layers1;
                layers1 = layers0;
                return layers0 = d;
            }).transition().duration(2500).attr("d", area);
        }

        // Inspired by Lee Byron's test data generator.
        function bumpLayer(n) {
            function bump(a) {
                var x = 1 / (.1 + Math.random()), y = 2 * Math.random() - .5, z = 10 / (.1 + Math.random());
                for (var i = 0; i < n; i++) {
                    var w = (i / n - y) * z;
                    a[i] += x * Math.exp(-w * w);
                }
            }

            var a = [], i;
            for (i = 0; i < n; ++i)
                a[i] = 0;
            for (i = 0; i < 5; ++i)
                bump(a);
            return a.map(function (d, i) {
                return { x: i, y: Math.max(0, d) };
            });
        }
    }

    // example from http://mbostock.github.io/d3/talk/20111116/force-collapsible.html
    function forceCollapsable2() {
        var w = 1280, h = 800, node, link, root;

        var force = d3.layout.force().on("tick", tick).charge(function (d) {
            return d._children ? -d.size / 100 : -30;
        }).linkDistance(function (d) {
            return d.target._children ? 80 : 30;
        }).size([w, h - 160]);

        var vis = d3.select("body").append("svg:svg").attr("width", w).attr("height", h);

        d3.json("flare.json", function (json) {
            root = json;
            root.fixed = true;
            root.x = w / 2;
            root.y = h / 2 - 80;
            update();
        });

        function update() {
            var nodes = flatten(root), links = d3.layout.tree().links(nodes);

            // Restart the force layout.
            force.nodes(nodes).links(links).start();

            // Update the links…
            link = vis.selectAll("line.link").data(links, function (d) {
                return d.target.id;
            });

            // Enter any new links.
            link.enter().insert("svg:line", ".node").attr("class", "link").attr("x1", function (d) {
                return d.source.x;
            }).attr("y1", function (d) {
                return d.source.y;
            }).attr("x2", function (d) {
                return d.target.x;
            }).attr("y2", function (d) {
                return d.target.y;
            });

            // Exit any old links.
            link.exit().remove();

            // Update the nodes…
            node = vis.selectAll("circle.node").data(nodes, function (d) {
                return d.id;
            }).style("fill", color);

            node.transition().attr("r", function (d) {
                return d.children ? 4.5 : Math.sqrt(d.size) / 10;
            });

            // Enter any new nodes.
            node.enter().append("svg:circle").attr("class", "node").attr("cx", function (d) {
                return d.x;
            }).attr("cy", function (d) {
                return d.y;
            }).attr("r", function (d) {
                return d.children ? 4.5 : Math.sqrt(d.size) / 10;
            }).style("fill", color).on("click", click).call(force.drag);

            // Exit any old nodes.
            node.exit().remove();
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

        // Color leaf nodes orange, and packages white or blue.
        function color(d) {
            return d._children ? "#3182bd" : d.children ? "#c6dbef" : "#fd8d3c";
        }

        // Toggle children on click.
        function click(d) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            update();
        }

        // Returns a list of all nodes under the root.
        function flatten(root) {
            var nodes = [], i = 0;

            function recurse(node) {
                if (node.children)
                    node.size = node.children.reduce(function (p, v) {
                        return p + recurse(v);
                    }, 0);
                if (!node.id)
                    node.id = ++i;
                nodes.push(node);
                return node.size;
            }

            root.size = recurse(root);
            return nodes;
        }
    }

    //exapmle from http://bl.ocks.org/mbostock/4062006
    function chordDiagram() {
        var matrix = [
            [11975, 5871, 8916, 2868],
            [1951, 10048, 2060, 6171],
            [8010, 16145, 8090, 8045],
            [1013, 990, 940, 6907]
        ];

        var chord = d3.layout.chord().padding(.05).sortSubgroups(d3.descending).matrix(matrix);

        var width = 960, height = 500, innerRadius = Math.min(width, height) * .41, outerRadius = innerRadius * 1.1;

        var fill = d3.scale.ordinal().domain(d3.range(4)).range(["#000000", "#FFDD89", "#957244", "#F26223"]);

        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height).append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        svg.append("g").selectAll("path").data(chord.groups).enter().append("path").style("fill", function (d) {
            return fill(d.index);
        }).style("stroke", function (d) {
            return fill(d.index);
        }).attr("d", d3.svg.arc().innerRadius(innerRadius).outerRadius(outerRadius)).on("mouseover", fade(.1)).on("mouseout", fade(1));

        var ticks = svg.append("g").selectAll("g").data(chord.groups).enter().append("g").selectAll("g").data(groupTicks).enter().append("g").attr("transform", function (d) {
            return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")" + "translate(" + outerRadius + ",0)";
        });

        ticks.append("line").attr("x1", 1).attr("y1", 0).attr("x2", 5).attr("y2", 0).style("stroke", "#000");

        ticks.append("text").attr("x", 8).attr("dy", ".35em").attr("transform", function (d) {
            return d.angle > Math.PI ? "rotate(180)translate(-16)" : null;
        }).style("text-anchor", function (d) {
            return d.angle > Math.PI ? "end" : null;
        }).text(function (d) {
            return d.label;
        });

        svg.append("g").attr("class", "chord").selectAll("path").data(chord.chords).enter().append("path").attr("d", d3.svg.chord().radius(innerRadius)).style("fill", function (d) {
            return fill(d.target.index);
        }).style("opacity", 1);

        // Returns an array of tick angles and labels, given a group.
        function groupTicks(d) {
            var k = (d.endAngle - d.startAngle) / d.value;
            return d3.range(0, d.value, 1000).map(function (v, i) {
                return {
                    angle: v * k + d.startAngle,
                    label: i % 5 ? null : v / 1000 + "k"
                };
            });
        }

        // Returns an event handler for fading a given chord group.
        function fade(opacity) {
            return function (g, i) {
                svg.selectAll(".chord path").filter(function (d) {
                    return d.source.index != i && d.target.index != i;
                }).transition().style("opacity", opacity);
            };
        }
    }

    //example from http://mbostock.github.io/d3/talk/20111116/iris-parallel.html
    function irisParallel() {
        var species = ["setosa", "versicolor", "virginica"], traits = ["sepal length", "petal length", "sepal width", "petal width"];

        var m = [80, 160, 200, 160], w = 1280 - m[1] - m[3], h = 800 - m[0] - m[2];

        var x = d3.scale.ordinal().domain(traits).rangePoints([0, w]), y = {};

        var line = d3.svg.line(), axis = d3.svg.axis().orient("left"), foreground;

        var svg = d3.select("body").append("svg:svg").attr("width", w + m[1] + m[3]).attr("height", h + m[0] + m[2]).append("svg:g").attr("transform", "translate(" + m[3] + "," + m[0] + ")");

        d3.csv("iris.csv", function (flowers) {
            // Create a scale and brush for each trait.
            traits.forEach(function (d) {
                // Coerce values to numbers.
                flowers.forEach(function (p) {
                    p[d] = +p[d];
                });

                y[d] = d3.scale.linear().domain(d3.extent(flowers, function (p) {
                    return p[d];
                })).range([h, 0]);

                y[d].brush = d3.svg.brush().y(y[d]).on("brush", brush);
            });

            // Add a legend.
            var legend = svg.selectAll("g.legend").data(species).enter().append("svg:g").attr("class", "legend").attr("transform", function (d, i) {
                return "translate(0," + (i * 20 + 584) + ")";
            });

            legend.append("svg:line").attr("class", String).attr("x2", 8);

            legend.append("svg:text").attr("x", 12).attr("dy", ".31em").text(function (d) {
                return "Iris " + d;
            });

            // Add foreground lines.
            foreground = svg.append("svg:g").attr("class", "foreground").selectAll("path").data(flowers).enter().append("svg:path").attr("d", path).attr("class", function (d) {
                return d.species;
            });

            // Add a group element for each trait.
            var g = svg.selectAll(".trait").data(traits).enter().append("svg:g").attr("class", "trait").attr("transform", function (d) {
                return "translate(" + x(d) + ")";
            }).call(d3.behavior.drag().origin(function (d) {
                return { x: x(d) };
            }).on("dragstart", dragstart).on("drag", drag).on("dragend", dragend));

            // Add an axis and title.
            g.append("svg:g").attr("class", "axis").each(function (d) {
                d3.select(this).call(axis.scale(y[d]));
            }).append("svg:text").attr("text-anchor", "middle").attr("y", -9).text(String);

            // Add a brush for each axis.
            g.append("svg:g").attr("class", "brush").each(function (d) {
                d3.select(this).call(y[d].brush);
            }).selectAll("rect").attr("x", -8).attr("width", 16);

            function dragstart(d, i) {
                i = traits.indexOf(d);
            }

            function drag(d, i) {
                x.range()[i] = d3.event.x;
                traits.sort(function (a, b) {
                    return x(a) - x(b);
                });
                g.attr("transform", function (d) {
                    return "translate(" + x(d) + ")";
                });
                foreground.attr("d", path);
            }

            function dragend(d) {
                x.domain(traits).rangePoints([0, w]);
                var t = d3.transition().duration(500);
                t.selectAll(".trait").attr("transform", function (d) {
                    return "translate(" + x(d) + ")";
                });
                t.selectAll(".foreground path").attr("d", path);
            }
        });

        // Returns the path for a given data point.
        function path(d) {
            return line(traits.map(function (p) {
                return [x(p), y[p](d[p])];
            }));
        }

        // Handles a brush event, toggling the display of foreground lines.
        function brush() {
            var actives = traits.filter(function (p) {
                return !y[p].brush.empty();
            }), extents = actives.map(function (p) {
                return y[p].brush.extent();
            });
            foreground.classed("fade", function (d) {
                return !actives.every(function (p, i) {
                    return extents[i][0] <= d[p] && d[p] <= extents[i][1];
                });
            });
        }
    }

    //example from
    function healthAndWealth() {
        // Various accessors that specify the four dimensions of data to visualize.
        function x(d) {
            return d.income;
        }
        function y(d) {
            return d.lifeExpectancy;
        }
        function radius(d) {
            return d.population;
        }
        function color(d) {
            return d.region;
        }
        function key(d) {
            return d.name;
        }

        // Chart dimensions.
        var margin = { top: 19.5, right: 19.5, bottom: 19.5, left: 39.5 }, width = 960 - margin.right, height = 500 - margin.top - margin.bottom;

        // Various scales. These domains make assumptions of data, naturally.
        var xScale = d3.scale.log().domain([300, 1e5]).range([0, width]), yScale = d3.scale.linear().domain([10, 85]).range([height, 0]), radiusScale = d3.scale.sqrt().domain([0, 5e8]).range([0, 40]), colorScale = d3.scale.category10();

        // The x & y axes.
        var xAxis = d3.svg.axis().orient("bottom").scale(xScale).ticks(12, d3.format(",d")), yAxis = d3.svg.axis().scale(yScale).orient("left");

        // Create the SVG container and set the origin.
        var svg = d3.select("#chart").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // Add the x-axis.
        svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxis);

        // Add the y-axis.
        svg.append("g").attr("class", "y axis").call(yAxis);

        // Add an x-axis label.
        svg.append("text").attr("class", "x label").attr("text-anchor", "end").attr("x", width).attr("y", height - 6).text("income per capita, inflation-adjusted (dollars)");

        // Add a y-axis label.
        svg.append("text").attr("class", "y label").attr("text-anchor", "end").attr("y", 6).attr("dy", ".75em").attr("transform", "rotate(-90)").text("life expectancy (years)");

        // Add the year label; the value is set on transition.
        var label = svg.append("text").attr("class", "year label").attr("text-anchor", "end").attr("y", height - 24).attr("x", width).text(1800);

        // Load the data.
        d3.json("nations.json", function (nations) {
            // A bisector since many nation's data is sparsely-defined.
            var bisect = d3.bisector(function (d) {
                return d[0];
            });

            // Add a dot per nation. Initialize the data at 1800, and set the colors.
            var dot = svg.append("g").attr("class", "dots").selectAll(".dot").data(interpolateData(1800)).enter().append("circle").attr("class", "dot").style("fill", function (d) {
                return colorScale(color(d));
            }).call(position).sort(order);

            // Add a title.
            dot.append("title").text(function (d) {
                return d.name;
            });

            // Add an overlay for the year label.
            var box = (label.node()).getBBox();

            var overlay = svg.append("rect").attr("class", "overlay").attr("x", box.x).attr("y", box.y).attr("width", box.width).attr("height", box.height).on("mouseover", enableInteraction);

            // Start a transition that interpolates the data based on year.
            svg.transition().duration(30000).ease("linear").tween("year", tweenYear).each("end", enableInteraction);

            // Positions the dots based on data.
            function position(dot) {
                dot.attr("cx", function (d) {
                    return xScale(x(d));
                }).attr("cy", function (d) {
                    return yScale(y(d));
                }).attr("r", function (d) {
                    return radiusScale(radius(d));
                });
            }

            // Defines a sort order so that the smallest dots are drawn on top.
            function order(a, b) {
                return radius(b) - radius(a);
            }

            // After the transition finishes, you can mouseover to change the year.
            function enableInteraction() {
                var yearScale = d3.scale.linear().domain([1800, 2009]).range([box.x + 10, box.x + box.width - 10]).clamp(true);

                // Cancel the current transition, if any.
                svg.transition().duration(0);

                overlay.on("mouseover", mouseover).on("mouseout", mouseout).on("mousemove", mousemove).on("touchmove", mousemove);

                function mouseover() {
                    label.classed("active", true);
                }

                function mouseout() {
                    label.classed("active", false);
                }

                function mousemove() {
                    displayYear(yearScale.invert(d3.mouse(this)[0]));
                }
            }

            // Tweens the entire chart by first tweening the year, and then the data.
            // For the interpolated data, the dots and label are redrawn.
            function tweenYear() {
                var year = d3.interpolateNumber(1800, 2009);
                return function (t) {
                    displayYear(year(t));
                };
            }

            // Updates the display to show the specified year.
            function displayYear(year) {
                dot.data(interpolateData(year), key).call(position).sort(order);
                label.text(Math.round(year));
            }

            // Interpolates the dataset for the given (fractional) year.
            function interpolateData(year) {
                return nations.map(function (d) {
                    return {
                        name: d.name,
                        region: d.region,
                        income: interpolateValues(d.income, year),
                        population: interpolateValues(d.population, year),
                        lifeExpectancy: interpolateValues(d.lifeExpectancy, year)
                    };
                });
            }

            // Finds (and possibly interpolates) the value for the specified year.
            function interpolateValues(values, year) {
                var i = bisect.left(values, year, 0, values.length - 1), a = values[i];
                if (i > 0) {
                    var b = values[i - 1], t = (year - a[0]) / (b[0] - a[0]);
                    return a[1] * (1 - t) + b[1] * t;
                }
                return a[1];
            }
        });
    }

    // Test for d3.functor
    function functorTest() {
        var f = d3.functor(10);
        var g = d3.functor(function (v) {
            return v;
        });

        return f(10) === g(10);
    }

    // Test for d3.Nest
    // Most test adopted from: https://github.com/mbostock/d3/blob/master/test/arrays/nest-test.js
    function nestTest() {
        var data = [
            {
                a: 10,
                b: [1, 2]
            },
            {
                a: 20,
                b: [2, 3]
            },
            {
                a: 30,
                b: [1, 2]
            }
        ];

        var n1 = d3.nest().key(function (d) {
            return d.a;
        }).sortKeys(d3.descending).rollup(function (vals) {
            return d3.sum(vals);
        });
        n1.map(data);
        n1.entries(data);

        var n2 = d3.nest().key(function (d) {
            return d.a;
        }).sortValues(function (x1, x2) {
            return x1[0] < x1[1] ? -1 : (x1[0] > x1[0] ? 1 : 0);
        });
        n2.map(data);
        n2.entries(data);

        // Tests adopted from d3's tests.
        var keys = d3.nest().key(function (d) {
            return d.foo;
        }).entries([{ foo: 1 }, { foo: 1 }, { foo: 2 }]).map(function (d) {
            return d.key;
        }).sort(d3.ascending);

        var entries = d3.nest().key(function (d) {
            return d.foo;
        }).entries([{ foo: 1, bar: 0 }, { foo: 2 }, { foo: 1, bar: 1 }]);

        keys = d3.nest().key(function (d) {
            return d.foo;
        }).sortKeys(d3.descending).entries([{ foo: 1 }, { foo: 1 }, { foo: 2 }]).map(function (d) {
            return d.key;
        });

        entries = d3.nest().key(function (d) {
            return d.foo;
        }).sortValues(function (a, b) {
            return a.bar - b.bar;
        }).entries([{ foo: 1, bar: 2 }, { foo: 1, bar: 0 }, { foo: 1, bar: 1 }, { foo: 2 }]);

        entries = d3.nest().key(function (d) {
            return d.foo;
        }).rollup(function (values) {
            return d3.sum(values, function (d) {
                return d.bar;
            });
        }).entries([{ foo: 1, bar: 2 }, { foo: 1, bar: 0 }, { foo: 1, bar: 1 }, { foo: 2 }]);

        entries = d3.nest().key(function (d) {
            return d[0];
        }).sortKeys(d3.ascending).key(function (d) {
            return d[1];
        }).sortKeys(d3.ascending).entries([[0, 1], [0, 2], [1, 1], [1, 2], [0, 2]]);

        entries = d3.nest().key(function (d) {
            return d[0];
        }).sortKeys(d3.ascending).key(function (d) {
            return d[1];
        }).sortKeys(d3.ascending).rollup(function (values) {
            return values.length;
        }).entries([[0, 1], [0, 2], [1, 1], [1, 2], [0, 2]]);

        entries = d3.nest().key(function (d) {
            return d[0];
        }).sortKeys(d3.ascending).key(function (d) {
            return d[1];
        }).sortKeys(d3.ascending).sortValues(function (a, b) {
            return a[2] - b[2];
        }).entries([[0, 1], [0, 2, 1], [1, 1], [1, 2], [0, 2, 0]]);

        var map = d3.nest().key(function (d) {
            return d[0];
        }).sortKeys(d3.ascending).key(function (d) {
            return d[1];
        }).sortKeys(d3.ascending).sortValues(function (a, b) {
            return a[2] - b[2];
        }).map([[0, 1], [0, 2, 1], [1, 1], [1, 2], [0, 2, 0]]);
    }

    // Test for setting attributes as an object
    // From https://github.com/mbostock/d3/blob/master/test/selection/attr-test.js
    function attrObjTest() {
        d3.select('body').data(["orange"]).attr({ "xlink:href": function (d, i) {
                return d + "-" + i + ".png";
            } });
    }

    // Test for brushes
    // This triggers a bug (shown below) in the 0.9.0 compiler, but works with
    // 0.9.1 compiler.
    // Stack trace:
    // /usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:38215
    //      return (type === this.semanticInfoChain.anyTypeSymbol) || type.isError();
    //                                                                     ^
    // TypeError: Cannot call method 'isError' of null
    //     at PullTypeResolver.isAnyOrEquivalent (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:38215:76)
    //     at PullTypeResolver.resolveNameExpression (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:39953:39)
    //     at PullTypeResolver.resolveAST (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:39758:37)
    //     at PullTypeResolver.computeIndexExpressionSymbol (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:40933:37)
    //     at PullTypeResolver.resolveIndexExpression (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:40925:45)
    //     at PullTypeResolver.resolveAST (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:39870:33)
    //     at PullTypeResolver.resolveOverloads (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:42917:43)
    //     at PullTypeResolver.computeCallExpressionSymbol (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:41373:34)
    //     at PullTypeResolver.resolveCallExpression (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:41175:29)
    //     at PullTypeChecker.typeCheckCallExpression (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:45111:58)
    //     at PullTypeChecker.typeCheckAST (/usr/local/share/npm/lib/node_modules/typescript/bin/tsc.js:43786:33)
    // function brushTest() {
    //     var xScale = d3.scale.linear(),
    //         yScale = d3.scale.linear();
    //
    //     var xMin = 0, xMax = 1,
    //         yMin = 0, yMax = 1;
    //
    //     // Setting only x scale.
    //     var brush1 = d3.svg.brush()
    //                     .x(xScale)
    //                     .on('brush', function () {
    //                         var extent = brush1.extent();
    //                         xMin = Math.max(extent[0], 0);
    //                         xMax = Math.min(extent[1], 1);
    //                         brush1.extent([xMin, xMax]);
    //                     });
    //
    //     // Setting both the x and y scale
    //     var brush2 = d3.svg.brush()
    //                     .x(xScale)
    //                     .y(yScale)
    //                     .on('brush', function () {
    //                         var extent = brush2.extent();
    //                         var xExtent = extent[0],
    //                             yExtent = extent[1];
    //
    //                         xMin = Math.max(xExtent[0], 0);
    //                         xMax = Math.min(xExtent[1], 1);
    //
    //                         yMin = Math.max(yExtent[0], 0);
    //                         yMax = Math.min(yExtent[1], 1);
    //
    //                         brush1.extent([[xMin, xMax], [yMin, yMax]]);
    //                     });
    // }
    // Tests for area
    // Adopted from: https://github.com/mbostock/d3/blob/master/test/svg/area-test.js
    function svgAreaTest() {
        var a = d3.svg.area();

        a.x()([0, 1]);
        a.x()([0, 1], 1);
        a.x(0);
        a.x(function (d) {
            return d.x * 10;
        });
        a.x(function (d, i) {
            return i * 10;
        });

        a.x0()([0, 1]);
        a.x0()([0, 1], 1);
        a.x0(0);
        a.x0(function (d) {
            return d.x * 10;
        });
        a.x0(function (d, i) {
            return i * 10;
        });

        a.x1()([0, 1]);
        a.x1()([0, 1], 1);
        a.x1(0);
        a.x1(function (d) {
            return d.x * 10;
        });
        a.x1(function (d, i) {
            return i * 10;
        });

        a.y()([0, 1]);
        a.y()([0, 1], 1);
        a.y(0);
        a.y(function (d) {
            return d.x * 10;
        });
        a.y(function (d, i) {
            return i * 10;
        });

        a.y0()([0, 1]);
        a.y0()([0, 1], 1);
        a.y0(0);
        a.y0(function (d) {
            return d.x * 10;
        });
        a.y0(function (d, i) {
            return i * 10;
        });

        a.y1()([0, 1]);
        a.y1()([0, 1], 1);
        a.y1(0);
        a.y1(function (d) {
            return d.x * 10;
        });
        a.y1(function (d, i) {
            return i * 10;
        });
    }

    // Tests for areaRadial
    // Adopted from: https://github.com/mbostock/d3/blob/master/test/svg/area-radial-test.js
    function svgAreaRadialTest() {
        var a = d3.svg.area.radial();

        a.x()([0, 1]);
        a.x()([0, 1], 1);
        a.x(0);
        a.x(function (d) {
            return d.x * 10;
        });
        a.x(function (d, i) {
            return i * 10;
        });

        a.x0()([0, 1]);
        a.x0()([0, 1], 1);
        a.x0(0);
        a.x0(function (d) {
            return d.x * 10;
        });
        a.x0(function (d, i) {
            return i * 10;
        });

        a.x1()([0, 1]);
        a.x1()([0, 1], 1);
        a.x1(0);
        a.x1(function (d) {
            return d.x * 10;
        });
        a.x1(function (d, i) {
            return i * 10;
        });

        a.y()([0, 1]);
        a.y()([0, 1], 1);
        a.y(0);
        a.y(function (d) {
            return d.x * 10;
        });
        a.y(function (d, i) {
            return i * 10;
        });

        a.y0()([0, 1]);
        a.y0()([0, 1], 1);
        a.y0(0);
        a.y0(function (d) {
            return d.x * 10;
        });
        a.y0(function (d, i) {
            return i * 10;
        });

        a.y1()([0, 1]);
        a.y1()([0, 1], 1);
        a.y1(0);
        a.y1(function (d) {
            return d.x * 10;
        });
        a.y1(function (d, i) {
            return i * 10;
        });

        a.radius(function () {
            return 10;
        });
        a.radius(function (d) {
            return d.x * 10;
        });
        a.radius(function (d, i) {
            return i * 10;
        });

        a.innerRadius(function () {
            return 10;
        });
        a.innerRadius(function (d) {
            return d.x * 10;
        });
        a.innerRadius(function (d, i) {
            return i * 10;
        });

        a.outerRadius(function () {
            return 10;
        });
        a.outerRadius(function (d) {
            return d.x * 10;
        });
        a.outerRadius(function (d, i) {
            return i * 10;
        });

        a.angle(function () {
            return 10;
        });
        a.angle(function (d) {
            return d.x * 10;
        });
        a.angle(function (d, i) {
            return i * 10;
        });

        a.startAngle(function () {
            return 10;
        });
        a.startAngle(function (d) {
            return d.x * 10;
        });
        a.startAngle(function (d, i) {
            return i * 10;
        });

        a.endAngle(function () {
            return 10;
        });
        a.endAngle(function (d) {
            return d.x * 10;
        });
        a.endAngle(function (d, i) {
            return i * 10;
        });
    }

    // Tests for d3.svg.line
    // Adopted from: https://github.com/mbostock/d3/blob/master/test/svg/line-test.js
    function svgLineTest() {
        var l = d3.svg.line();

        l.x()([0, 1]);
        l.x()([0, 1], 0);
        l.x(0);
        l.x(function (d) {
            return d.x;
        });
        l.x(function (d, i) {
            return i;
        });

        l.y()([0, 1]);
        l.y()([0, 1], 0);
        l.y(0);
        l.y(function (d) {
            return d.y;
        });
        l.y(function (d, i) {
            return i;
        });
    }

    // Tests for d3.svg.line.radial
    // Adopted from: https://github.com/mbostock/d3/blob/master/test/svg/line-radial-test.js
    function svgLineRadialTest() {
        var l = d3.svg.line.radial();

        l.x()([0, 1]);
        l.x()([0, 1], 0);
        l.x(0);
        l.x(function (d) {
            return d.x;
        });
        l.x(function (d, i) {
            return i;
        });

        l.y()([0, 1]);
        l.y()([0, 1], 0);
        l.y(0);
        l.y(function (d) {
            return d.y;
        });
        l.y(function (d, i) {
            return i;
        });

        l.radius()([0, 1]);
        l.radius()([0, 1], 0);
        l.radius(0);
        l.radius(function (d) {
            return d.x;
        });
        l.radius(function (d, i) {
            return i;
        });

        l.angle()([0, 1]);
        l.angle()([0, 1], 0);
        l.angle(0);
        l.angle(function (d) {
            return d.y;
        });
        l.angle(function (d, i) {
            return i;
        });
    }

    // Tests for d3.svg.arc
    // Adopted from: https://github.com/mbostock/d3/blob/master/test/svg/arc-test.js
    function svgArcTest() {
        var l = d3.svg.arc();

        l.innerRadius()([0, 1]);
        l.innerRadius()([0, 1], 0);
        l.innerRadius(0);
        l.innerRadius(function (d) {
            return d.x;
        });
        l.innerRadius(function (d, i) {
            return i;
        });

        l.outerRadius()([0, 1]);
        l.outerRadius()([0, 1], 0);
        l.outerRadius(0);
        l.outerRadius(function (d) {
            return d.x;
        });
        l.outerRadius(function (d, i) {
            return i;
        });

        l.startAngle()([0, 1]);
        l.startAngle()([0, 1], 0);
        l.startAngle(0);
        l.startAngle(function (d) {
            return d.x;
        });
        l.startAngle(function (d, i) {
            return i;
        });

        l.endAngle()([0, 1]);
        l.endAngle()([0, 1], 0);
        l.endAngle(0);
        l.endAngle(function (d) {
            return d.x;
        });
        l.endAngle(function (d, i) {
            return i;
        });
    }

    // Tests for d3.svg.diagonal
    // Adopted from: https://github.com/mbostock/d3/blob/master/test/svg/diagonal-test.js
    function svgDiagonalTest() {
        var d = d3.svg.diagonal();

        d.projection()({ x: 0, y: 1 });
        d.projection()({ x: 0, y: 1 }, 0);
        d.projection(function (d) {
            return [d.x, d.y];
        });
        d.projection(function (d, i) {
            return [i, i + 1];
        });

        d.source()({ x: 0, y: 1 });
        d.source()({ x: 0, y: 1 }, 0);
        d.source({ x: 0, y: 1 });
        d.source(function (d) {
            return { x: d.x, y: d.y };
        });
        d.source(function (d, i) {
            return { x: d.x * i, y: d.y * i };
        });

        d.target()({ x: 0, y: 1 });
        d.target()({ x: 0, y: 1 }, 0);
        d.target({ x: 0, y: 1 });
        d.target(function (d) {
            return { x: d.x, y: d.y };
        });
        d.target(function (d, i) {
            return { x: d.x * i, y: d.y * i };
        });
    }
})(d3Tests || (d3Tests = {}));
