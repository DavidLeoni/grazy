/// <reference path="../../js/com.facebook.immutable/immutable.d.ts" />
/// <reference path="../../js/promisespromises/Promises.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};


var stolang;
(function (stolang) {
    var Imm = Immutable;
    var ImmOrdMap = Immutable.OrderedMap;

    stolang.STOCAS_PREFIX = "stocas";
    stolang.STOCAS_IRI = "https://github.com/davidleoni/stocas/";

    /**
    * Usage: callConstructor(MyConstructor, arg1, arg2);
    */
    stolang.callConstructor = function (constr) {
        var factoryFunction = constr.bind.apply(constr, arguments);
        return new factoryFunction();
    };

    /**
    Immutable. Adopts JsonLD tags.
    */
    var GraphNode = (function () {
        function GraphNode() {
        }
        return GraphNode;
    })();
    stolang.GraphNode = GraphNode;

    stolang.EmptyGraph = {
        "@id": stolang.STOCAS_IRI + "empty-node",
        "@reverse": []
    };

    /**
    * Usage: applyToConstructor(MyConstructor, [arg1, arg2]);
    */
    stolang.applyToConstructor = function (constr, argArray) {
        var args = [null].concat(argArray);
        var factoryFunction = constr.bind.apply(constr, args);
        return new factoryFunction();
    };

    /**
    * This class encapsulates Javascript Error object. It doesn't extend it because all the error inheritance stuff
    * in Javascript is really fucked up.
    *
    */
    var StoErr = (function () {
        /**
        * You must pass a JavaScript Error so browser can keep track of stack execution. Message in original error is not considered.
        * Usage example: new StoErr(new Error(), "We got a problem!", "This object looks fishy: ", {a:666});
        * @param message Overrides message in Error.
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

        /** Reports the error to console with console.log */
        StoErr.prototype.consoleLog = function () {
            console.log.apply(console, this.allParams());
            console.log(this.error);
        };

        /** Reports the error to console with console.error */
        StoErr.prototype.consoleError = function () {
            var completeParams = this.allParams().slice(0);
            completeParams.push(" \n", this.error);
            console.error.apply(console, completeParams);
        };
        return StoErr;
    })();
    stolang.StoErr = StoErr;

    var EqErr = (function (_super) {
        __extends(EqErr, _super);
        function EqErr(error, actual) {
            _super.call(this, error, "Failed assertion!", "  Expected something different than ->", actual, "<-\n");
            this.actual = actual;
        }
        return EqErr;
    })(StoErr);
    stolang.EqErr = EqErr;

    var NotEqErr = (function (_super) {
        __extends(NotEqErr, _super);
        function NotEqErr(error, expected, actual) {
            _super.call(this, error, "Failed assertion!", "  Expected ->", expected, "<-\n", "  Actual   ->", actual, "<-");
            this.expected = expected;
            this.actual = actual;
        }
        return NotEqErr;
    })(StoErr);
    stolang.NotEqErr = NotEqErr;

    /**
    * Takes a variable number of arguments and displays them as concatenated strings in an alert message, plus it calls console.error with the same arguments. Usage example:
    * signal(new Error(), "We got a problem", "Expected: ", 3, " got:", 2 + 2);
    * @returns {StoErr}
    */
    stolang.report = function (error) {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 1); _i++) {
            args[_i] = arguments[_i + 1];
        }
        var i;
        var arr = [];
        for (i = 0; i < arguments.length; i++) {
            arr.push(arguments[i]);
        }
        var exc = stolang.applyToConstructor(StoErr, arr);

        exc.toConsole();
        alert(exc.toString() + "\n\nLook in the console for more details.");
        return exc;
    };

    

    (function (_test) {
        /**
        * Returns EqErr in case actual is equals to notExpected.
        * Doesn't throw any exception
        * @return null if no error occurred
        */
        function assertNotEquals(notExpected, actual) {
            var res = Imm.is(actual, notExpected);
            if (res) {
                return new EqErr(new Error(), actual);
            } else {
                return null;
            }
            ;
        }
        _test.assertNotEquals = assertNotEquals;
        ;

        /**
        * Doesn't throw any exception,
        * @return null if no error occurred
        */
        function assertEquals(expected, actual) {
            var res = Imm.is(actual, expected);
            if (res) {
                return null;
            } else {
                return new NotEqErr(new Error(), expected, actual);
            }
            ;
        }
        _test.assertEquals = assertEquals;
        ;

        var TestResult = (function () {
            function TestResult(testName, test, error) {
                this.testName = testName;
                this.test = test;
                this.error = error;
            }
            return TestResult;
        })();
        _test.TestResult = TestResult;

        var TestSuite = (function () {
            function TestSuite(name, tests) {
                this.testResults = [];
                this.passedTests = [];
                this.failedTests = [];
                this.name = name;
                this.tests = tests;
            }
            TestSuite.prototype.run = function () {
                this.testResults = [];
                this.passedTests = [];
                this.failedTests = [];

                for (var key in this.tests) {
                    var stoerr = null;
                    try  {
                        stoerr = this.tests[key]();
                    } catch (catchedError) {
                        if (catchedError instanceof StoErr) {
                            stoerr = catchedError;
                        } else {
                            stoerr = new StoErr(catchedError, "Test threw an Error!");
                        }
                    }
                    var testRes = new TestResult(key, this.tests[key], stoerr);
                    this.testResults.push(testRes);

                    if (stoerr) {
                        this.failedTests.push(testRes);
                    } else {
                        this.passedTests.push(testRes);
                    }
                }
            };
            return TestSuite;
        })();
        _test.TestSuite = TestSuite;
    })(stolang.test || (stolang.test = {}));
    var test = stolang.test;

    var Trees = (function () {
        function Trees() {
        }
        /**
        * Recursively applies function makeM to a node of type N and
        * M-fied children of type M, so the resulting tree will have type M
        * @param getChildren leaf nodes have zero children
        * @param makeM function that takes node to M-ify,
        *        the field name (or index) that was holding it
        *        and its now M-fied children
        */
        Trees.fold = function (rootNode, getChildren, makeM) {
            var processedNodesCounter = 0;

            /** Holds original nodes */
            var stack1 = [{
                    key: null,
                    node: rootNode
                }];

            /** Holds nodes-as-expressions that still need to be completely filled with
            M-fied children */
            var stack2 = [];

            /**
            Inserts node to existing children container in top entry of stack2.
            If inserting the node fills the children container,
            resolves expressions popping nodes in stack2. If stack2 gets empty
            returns last calculated expression, otherwise return null.
            */
            var nodeToStack2 = function (key, node) {
                var toInsert = makeM(key, node, ImmOrdMap.empty());
                var curKey = key;

                while (stack2.length > 0) {
                    var top2 = stack2[0];

                    top2.children.unshift([curKey, toInsert]);

                    if (top2.children.length > top2.neededChildren) {
                        throw new StoErr(new Error(), "Found more children in top2 than the needed ones!", "stack1: ", stack1, "top2 =", top2, "stack2: ", stack2);
                    }

                    if (top2.neededChildren === top2.children.length) {
                        stack2.shift();

                        toInsert = makeM(top2.key, top2.node, ImmOrdMap.from(top2.children));
                        curKey = top2.key;
                    } else {
                        return null;
                    }
                }

                return toInsert;
            };

            var ret;

            while (stack1.length > 0) {
                var el = stack1.shift();

                var children = getChildren(el.node);

                if (children.length === 0) {
                    ret = nodeToStack2(el.key, el.node);
                    if (stack1.length === 0) {
                        if (stack2.length > 0) {
                            throw new StoErr(new Error(), "Found non-empty stack2: ", stack2);
                        }
                        return ret;
                    } else {
                        if (stack2.length === 0) {
                            return ret;
                        } else {
                            if (ret) {
                                throw new StoErr(new Error(), "ret should be null, found instead ", ret);
                            }
                        }
                    }
                } else {
                    children.forEach(function (c, k) {
                        stack1.unshift({
                            node: c,
                            key: k
                        });
                    });
                    var childrenContainer = [];
                    var toStack2 = {
                        node: el.node,
                        key: el.key,
                        neededChildren: children.length,
                        children: childrenContainer
                    };
                    stack2.unshift(toStack2);
                }
            }

            throw new Error("Shouldn't arrive till here...");

            return makeM(null, null, null);
        };

        Trees.height = function (node, getChildren) {
            return Trees.fold(node, getChildren, function (parentField, n, cs) {
                return cs.length === 0 ? 0 : Math.max.apply(null, cs.toArray()) + 1;
            });
        };
        return Trees;
    })();
    stolang.Trees = Trees;
})(stolang || (stolang = {}));
//# sourceMappingURL=stolang.js.map
