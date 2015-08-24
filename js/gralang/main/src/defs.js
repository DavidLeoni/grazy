var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports"], function (require, exports) {
    exports.GRAZY_PREFIX = 'grazy';
    exports.GRAZY_IRI = 'https://github.com/DavidLeoni/grazy/';
    /**
     * Usage: callConstructor(MyConstructor, arg1, arg2);
     */
    exports.callConstructor = function (constr) {
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
    exports.GraphNode = GraphNode;
    exports.EmptyGraph = {
        "@id": exports.GRAZY_IRI + "empty-node",
        "@reverse": []
    };
    /**
     * Usage: applyToConstructor(MyConstructor, [arg1, arg2]);
     */
    exports.applyToConstructor = function (constr, argArray) {
        var args = [null].concat(argArray);
        var factoryFunction = constr.bind.apply(constr, args);
        return new factoryFunction();
    };
    (function (ObjStatus) {
        ObjStatus[ObjStatus["COMPLETED"] = 0] = "COMPLETED";
        ObjStatus[ObjStatus["TO_CALCULATE"] = 1] = "TO_CALCULATE";
        ObjStatus[ObjStatus["ERROR"] = 2] = "ERROR";
    })(exports.ObjStatus || (exports.ObjStatus = {}));
    var ObjStatus = exports.ObjStatus;
    /**
     * todo p1 add decorator for creating withers,
     * see http://stackoverflow.com/questions/31224574/generate-generic-getters-and-setters-for-entity-properties-using-decorators
     */
    var Obj = (function () {
        function Obj() {
            this.__status = ObjStatus.TO_CALCULATE;
            /**
             * Eventual error is status is 'ERROR'
             */
            this.__error = Errors.NONE;
        }
        /**
         * Returns new object with property prop set to v. Property MUST belong to object type definition propoerties
         * TODO this currently doesn't do any type checking (sic), maybe maybe we can fix it.
         * Also, for output type, see https://github.com/Microsoft/TypeScript/issues/285
         * See also 'Compile-time checking of string literal arguments based on type': https://github.com/Microsoft/TypeScript/issues/394
         * 'nameof' operator support: https://github.com/Microsoft/TypeScript/issues/1579
         *
         */
        Obj.prototype.with = function (prop, v) {
            var ret = {};
            for (var _i = 0, _a = Object.keys(this); _i < _a.length; _i++) {
                var k = _a[_i];
                ret[k] = this[k];
            }
            ret[prop] = v;
            return ret;
        };
        return Obj;
    })();
    exports.Obj = Obj;
    /**
     * This class encapsulates Javascript Error object. It doesn't extend it because all the error inheritance stuff
     * in Javascript is really fucked up.
     *
     */
    var Err = (function (_super) {
        __extends(Err, _super);
        /**
         * You must pass a JavaScript Error so browser can keep track of stack execution. Message in original error is not considered.
         * Usage example: new GrazyErr(new Error(), "We got a problem!", "This object looks fishy: ", {a:666});
         * @param message Overrides message in Error.
         */
        function Err(error, message) {
            var params = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                params[_i - 2] = arguments[_i];
            }
            _super.call(this);
            // console.error.apply(null, params);
            this.name = this.constructor.name;
            this.message = message;
            this.error = error;
            this.params = params;
        }
        Err.prototype.toString = function () {
            return this.allParams().join("");
        };
        /**
         * Returns array with name, message plus all params
         */
        Err.prototype.allParams = function () {
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
        Err.prototype.consoleLog = function () {
            console.log.apply(console, this.allParams());
            console.log(this.error);
        };
        /** Reports the error to console with console.error */
        Err.prototype.consoleError = function () {
            var completeParams = this.allParams().slice(0);
            completeParams.push(" \n", this.error);
            console.error.apply(console, completeParams);
        };
        return Err;
    })(Obj);
    exports.Err = Err;
    var Errors;
    (function (Errors) {
        Errors.NONE = new Err(null, "");
    })(Errors = exports.Errors || (exports.Errors = {}));
    var EqErr = (function (_super) {
        __extends(EqErr, _super);
        function EqErr(error, actual) {
            _super.call(this, error, "Failed assertion!", "  Expected something different than ->", actual, "<-\n");
            this.actual = actual;
        }
        return EqErr;
    })(Err);
    exports.EqErr = EqErr;
    var NotEqErr = (function (_super) {
        __extends(NotEqErr, _super);
        function NotEqErr(error, expected, actual) {
            _super.call(this, error, "Failed assertion!", "  Expected ->", expected, "<-\n", "  Actual   ->", actual, "<-");
            this.expected = expected;
            this.actual = actual;
        }
        return NotEqErr;
    })(Err);
    exports.NotEqErr = NotEqErr;
    var Nats;
    (function (Nats) {
    })(Nats = exports.Nats || (exports.Nats = {}));
    var Bool = (function () {
        function Bool() {
        }
        return Bool;
    })();
    exports.Bool = Bool;
    function if_(c, t, e) {
    }
    exports.if_ = if_;
    var Cons = (function () {
        function Cons() {
        }
        Cons.prototype.next = function () {
            throw new Error("todo implement me");
        };
        return Cons;
    })();
    exports.Cons = Cons;
    /**
     * Takes a variable number of arguments and displays them as concatenated strings in an alert message, plus it calls console.error with the same arguments. Usage example:
     * signal(new Error(), "We got a problem", "Expected: ", 3, " got:", 2 + 2);
     * @returns {GrazyErr}
     */
    exports.report = function (error) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var i;
        var arr = [];
        for (i = 0; i < arguments.length; i++) {
            arr.push(arguments[i]);
        }
        var exc = exports.applyToConstructor(Err, arr);
        exc.toConsole();
        alert(exc.toString() + "\n\nLook in the console for more details.");
        return exc;
    };
    var test;
    (function (test_1) {
        /**azy
         * Returns EqErr in case actual is equals to notExpected.
         * Doesn't throw any exception
         * @return null if no error occurred
        */
        function assertNotEquals(notExpected, actual) {
            var res = Object.is(actual, notExpected);
            if (res) {
                return new EqErr(new Error(), actual);
            }
            else {
                return null;
            }
            ;
        }
        test_1.assertNotEquals = assertNotEquals;
        ;
        /**
         * Doesn't throw any exception,
         * @return null if no error occurred
        */
        function assertEquals(expected, actual) {
            var res = Object.is(actual, expected);
            if (res) {
                return null;
            }
            else {
                return new NotEqErr(new Error(), expected, actual);
            }
            ;
        }
        test_1.assertEquals = assertEquals;
        ;
        var TestResult = (function () {
            function TestResult(testName, test, error) {
                this.testName = testName;
                this.test = test;
                this.error = error;
            }
            return TestResult;
        })();
        test_1.TestResult = TestResult;
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
                    var grazyErr = null;
                    try {
                        grazyErr = this.tests[key]();
                    }
                    catch (catchedError) {
                        if (catchedError instanceof Err) {
                            grazyErr = catchedError;
                        }
                        else {
                            grazyErr = new Err(catchedError, "Test threw an Error!");
                        }
                    }
                    var testRes = new TestResult(key, this.tests[key], grazyErr);
                    this.testResults.push(testRes);
                    if (grazyErr) {
                        this.failedTests.push(testRes);
                    }
                    else {
                        this.passedTests.push(testRes);
                    }
                }
            };
            return TestSuite;
        })();
        test_1.TestSuite = TestSuite;
    })(test = exports.test || (exports.test = {}));
    var Trees;
    (function (Trees) {
        /**
         * Recursively applies function makeM to a node of type N and
         * M-fied children of type M, so the resulting tree will have type M
         * @param getChildren leaf nodes have zero children
         * @param makeM function that takes node to M-ify,
         *        the field name (or index) that was holding it
         *        and its now M-fied children
         */
        function fold(rootNode, getChildren, makeM) {
            var processedNodesCounter = 0;
            /** Holds original nodes */
            var stack1 = [{
                    key: null,
                    node: rootNode
                }]; // only rootNode should have null as key
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
                var toInsert = makeM(key, node, []);
                var curKey = key;
                while (stack2.length > 0) {
                    var top2 = stack2[0];
                    top2.children.unshift([curKey, toInsert]);
                    if (top2.children.length > top2.neededChildren) {
                        throw new Err(new Error(), "Found more children in top2 than the needed ones!", "stack1: ", stack1, "top2 =", top2, "stack2: ", stack2);
                    }
                    if (top2.neededChildren === top2.children.length) {
                        stack2.shift();
                        toInsert = makeM(top2.key, top2.node, top2.children);
                        curKey = top2.key;
                    }
                    else {
                        return null;
                    }
                }
                return toInsert; // stack2.length = 0
            };
            var ret;
            while (stack1.length > 0) {
                var el = stack1.shift();
                var children = getChildren(el.node);
                if (children.length === 0) {
                    ret = nodeToStack2(el.key, el.node);
                    if (stack1.length === 0) {
                        if (stack2.length > 0) {
                            throw new Err(new Error(), "Found non-empty stack2: ", stack2);
                        }
                        return ret;
                    }
                    else {
                        if (stack2.length === 0) {
                            return ret;
                        }
                        else {
                            if (ret) {
                                throw new Err(new Error(), "ret should be null, found instead ", ret);
                            }
                        }
                    }
                }
                else {
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
        }
        Trees.fold = fold;
        function height(node, getChildren) {
            return Trees.fold(node, getChildren, function (parentField, n, cs) {
                return cs.length === 0 ?
                    0
                    : Math.max.apply(null, cs) + 1;
            });
        }
        Trees.height = height;
    })(Trees = exports.Trees || (exports.Trees = {}));
});
//# sourceMappingURL=defs.js.map