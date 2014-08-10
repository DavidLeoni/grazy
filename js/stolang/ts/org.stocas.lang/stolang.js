/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />

var stolang;
(function (stolang) {
    stolang.STOCAS_PREFIX = "stocas";
    stolang.STOCAS_IRI = "https://github.com/davidleoni/stocas/";

    /**
    * This class encapsulates Javascript Error object. It doesn't extend it because all the error inheritance stuff
    * in Javascript is really fucked up
    *
    */
    var StoErr = (function () {
        /**
        * @param message Overrides message in Error. The field name of provided Error is set to " ", so it doesn't show in console
        */
        function StoErr(error, message) {
            var params = [];
            for (var _i = 0; _i < (arguments.length - 2); _i++) {
                params[_i] = arguments[_i + 2];
            }
            // console.error.apply(null, params);
            this.name = this.constructor.name;
            this.message = message;
            this.error = error;
            this.error.name = " ";
            this.params = params;
        }
        StoErr.prototype.toString = function () {
            return this.allParams().join("");
        };

        /**
        * Returns array with name, message plus all params
        */
        StoErr.prototype.allParams = function () {
            var ret = this.params.slice(0);
            var afterMsg = "\n";
            if (this.params.length > 0) {
                afterMsg = "\n";
            }
            ret.unshift(this.message + afterMsg);
            ret.unshift(this.name + ":");
            return ret;
        };

        StoErr.prototype.logToConsole = function () {
            console.log.apply(console, this.allParams());
            console.log(this.error);
        };

        StoErr.prototype.toConsole = function () {
            var completeParams = this.allParams().slice(0);
            completeParams.push(this.error);
            console.error.apply(console, completeParams);
        };
        return StoErr;
    })();
    stolang.StoErr = StoErr;

    

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
//# sourceMappingURL=stolang.js.map
