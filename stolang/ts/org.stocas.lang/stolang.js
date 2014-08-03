/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />

var stolang;
(function (stolang) {
    stolang.STOCAS_PREFIX = "stocas";
    stolang.STOCAS_IRI = "https://github.com/davidleoni/stocas/";

    var StoError = (function () {
        function StoError() {
            var params = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                params[_i] = arguments[_i + 0];
            }
            console.error.apply(null, params);

            this.name = "StoError";
            this.message = params[0];
            this.stack = (new Error()).stack;
            this.params = params;
        }
        StoError.prototype.toString = function () {
            return this.params.join();
        };
        return StoError;
    })();
    stolang.StoError = StoError;

    

    var Trees = (function () {
        function Trees() {
        }
        /**
        * @param getChildren if null node is a leaf
        */
        Trees.fold = function (rootNode, /** if null node is considered a leaf */
        getChildren, makeM) {
            var stack1 = [rootNode];
            var stack2 = [];

            /**
            inserts node to existing children. If children list is full,
            resolves expressions popping nodes in stack2 until meets a list with not enough children
            */
            var nodeToStack2 = function (node) {
                var toInsert = makeM(node, []);

                while (stack2.length > 0) {
                    var top2 = stack2[0];
                    top2.children.unshift(toInsert);

                    if (top2.neededChildren == stack2[0].children.length) {
                        var poppedTop2 = stack2.pop();
                        toInsert = makeM(poppedTop2.node, poppedTop2.children);
                    } else {
                        return toInsert;
                    }
                }

                return toInsert;
            };

            var ret;

            while (stack1.length > 0) {
                var el = stack1.pop();
                var children = getChildren(el);

                // non-leaf node
                if (children == null || children.length == 0) {
                    ret = nodeToStack2(el);
                    if (stack2.length == 0) {
                        return ret;
                    }
                } else {
                    $.each(children, function (i, c) {
                        stack1.unshift(c);
                    });
                    stack2.unshift({
                        node: el,
                        neededChildren: children.length,
                        children: []
                    });
                }
            }

            throw new Error("Shouldn't arrive till here...");
            return makeM(null, []);
        };
        return Trees;
    })();
    stolang.Trees = Trees;
})(stolang || (stolang = {}));

var stolangTest;
(function (stolangTest) {
    var Trees = stolang.Trees;
    var StoError = stolang.StoError;

    var assertTrue = function (actual, expected) {
        var res = Im.is(actual, expected);
        if (res) {
        } else {
            throw new StoError("Failed assertion! Expected: ->", expected, "<-   Actual: ->", actual, "<-");
        }
        ;
    };

    assertTrue(Trees.fold({}, function (n) {
        return null;
    }, function (n) {
        return 3;
    }), 3);
})(stolangTest || (stolangTest = {}));
