/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

var stolang;
(function (stolang) {
    var Imm = Immutable;
    stolang.STOCAS_PREFIX = "stocas";
    stolang.STOCAS_IRI = "https://github.com/davidleoni/stocas/";

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

        StoErr.prototype.logToConsole = function () {
            console.log.apply(console, this.allParams());
            console.log(this.error);
        };

        StoErr.prototype.toConsole = function () {
            var completeParams = this.allParams().slice(0);
            completeParams.push(" \n", this.error);
            console.error.apply(console, completeParams);
        };
        return StoErr;
    })();
    stolang.StoErr = StoErr;

    

    var EqErr = (function (_super) {
        __extends(EqErr, _super);
        function EqErr(error, expected, actual) {
            _super.call(this, error, "Failed assertion!", "  Expected ->", expected, "<-\n", "  Actual   ->", actual, "<-");
            this.expected = expected;
            this.actual = actual;
        }
        return EqErr;
    })(StoErr);
    stolang.EqErr = EqErr;

    (function (_test) {
        /**
        * Doesn't throw any exception,
        * @return null if no error occurred
        */
        function assertEquals(actual, expected) {
            var res = Imm.is(actual, expected);
            if (res) {
                return null;
            } else {
                return new EqErr(new Error(), expected, actual);
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
            function TestSuite(tests) {
                this.testResults = [];
                this.passedTests = [];
                this.failedTests = [];
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
                        stoerr = new StoErr(catchedError, "Test threw an Error!");
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
