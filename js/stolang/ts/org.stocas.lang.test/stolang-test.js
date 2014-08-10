/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />
/// <reference path="../ts/org.stocas.lang/stolang.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/*
* New TypeScript file
*/
var stolangTest;
(function (stolangTest) {
    var Trees = stolang.Trees;
    var StoErr = stolang.StoErr;
    var Im = Immutable;

    var EqErr = (function (_super) {
        __extends(EqErr, _super);
        function EqErr(error, expected, actual) {
            _super.call(this, error, "Failed assertion!", "  Expected ->", expected, "<-\n", "  Actual   ->", actual, "<-");
            this.expected = expected;
            this.actual = actual;
        }
        return EqErr;
    })(StoErr);
    stolangTest.EqErr = EqErr;

    var TestResult = (function () {
        function TestResult(testName, test, error) {
            this.testName = testName;
            this.test = test;
            this.error = error;
        }
        return TestResult;
    })();

    /**
    * @return null if no error occurred
    */
    var assertEquals = function (actual, expected) {
        var res = Im.is(actual, expected);
        if (res) {
            return null;
        } else {
            return new EqErr(new Error(), expected, actual);
        }
        ;
    };

    stolangTest.tests = {
        testEmptyTree: function () {
            return assertEquals(Trees.fold({}, function (n) {
                return null;
            }, function (n) {
                return 3;
            }), 3);
        },
        testError: function () {
            return assertEquals(true, false);
        }
    };

    var runTests = function () {
        var testResults = [];
        var passedTests = [];
        var failedTests = [];

        for (var key in stolangTest.tests) {
            var stoerr = null;
            try  {
                stoerr = stolangTest.tests[key]();
            } catch (catchedError) {
                stoerr = new StoErr(catchedError, "Test threw an Error!");
            }
            var testRes = new TestResult(key, stolangTest.tests[key], stoerr);
            testResults.push(testRes);

            if (stoerr) {
                failedTests.push(testRes);
            } else {
                passedTests.push(testRes);
            }
        }
        ;

        document.write("<span class='error'> Total tests: " + (passedTests.length + failedTests.length) + "</span></br>");
        document.write("<br/>");
        if (failedTests.length > 0) {
            document.write("<span class='error'> Suite FAILURE: " + failedTests.length + " tests failed. </span>");
            document.write("<span class='error'>Check console after  clicking on failed tests.</span><br/>");
            document.write("<br/>");
        } else {
            document.write("<span class='success'> Suite SUCCESS: All tests passed. </span></br>");
        }

        testResults.forEach(function (tr) {
            var testStatus = null;
            var styleClass = null;
            if (tr.error) {
                testStatus = "FAILED";
                styleClass = "error clickable";
            } else {
                testStatus = "PASSED";
                styleClass = "success clickable";
            }

            $("body").append($('<span>').addClass(styleClass).text("" + tr.testName + " : " + testStatus).on('click', function () {
                if (tr.error) {
                    tr.error.toConsole();
                } else {
                    console.log(tr.testName + "code: ", tr.test);
                }

                return false;
            }));
            $("body").append($('<span>').text(" Run again").addClass(styleClass).on('click', function () {
                console.error('todo implement me!');
                return false;
            }));
            $("body").append($('</br>'));
        });
    };

    runTests();
})(stolangTest || (stolangTest = {}));
//# sourceMappingURL=stolang-test.js.map
