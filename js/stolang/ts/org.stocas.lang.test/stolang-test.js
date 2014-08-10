/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />
/// <reference path="../ts/org.stocas.lang/stolang.ts" />
/*
* New TypeScript file
*/
var stolangTest;
(function (stolangTest) {
    var Trees = stolang.Trees;

    var TestSuite = stolang.test.TestSuite;
    var assertEquals = stolang.test.assertEquals;

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
        var testSuite = new TestSuite(stolangTest.tests);

        testSuite.run();

        document.write("<span class='error'> Total tests: " + (testSuite.passedTests.length + testSuite.failedTests.length) + "</span></br>");
        document.write("<br/>");
        if (testSuite.failedTests.length > 0) {
            document.write("<span class='error'> Suite FAILURE: " + testSuite.failedTests.length + " tests failed. </span>");
            document.write("<span class='error'>Check console after  clicking on failed tests.</span><br/>");
            document.write("<br/>");
        } else {
            document.write("<span class='success'> Suite SUCCESS: All tests passed. </span></br>");
        }

        testSuite.testResults.forEach(function (tr) {
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
