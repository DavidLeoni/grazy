/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />
/// <reference path="../ts/org.stocas.lang/stolang.ts" />
/*
* New TypeScript file
*/
var stolangTest;
(function (stolangTest) {
    var Trees = stolang.Trees;
    var StoError = stolang.StoError;
    var Im = Immutable;

    var assertTrue = function (actual, expected) {
        var res = Im.is(actual, expected);
        if (res) {
        } else {
            throw new StoError("Failed assertion! Expected: ->", expected, "<-   Actual: ->", actual, "<-");
        }
        ;
    };

    stolangTest.tests = {
        testTrees: function () {
            assertTrue(Trees.fold({}, function (n) {
                return null;
            }, function (n) {
                return 3;
            }), 3);
        }
    };

    var runTests = function () {
        var failedTests = 0;
        var passedTests = 0;
        for (var k in stolangTest.tests) {
            try  {
                stolangTest.tests[k]();
                passedTests += 1;
                document.write(k + " : PASSED<br/>");
            } catch (e) {
                failedTests += 1;
                document.write(k + " : FAILED<br/>");
            }
        }
        ;
        document.write("<br/>");
        document.write("<br/>");
        document.write("Total tests: " + (passedTests + failedTests));
        document.write("<br/>");
        if (failedTests > 0) {
            document.write("Suite FAILURE: " + failedTests + " tests failed.");
        } else {
            document.write("Suite SUCCESS: All tests passed.");
        }
    };

    runTests();
})(stolangTest || (stolangTest = {}));
//# sourceMappingURL=stolang-test.js.map
