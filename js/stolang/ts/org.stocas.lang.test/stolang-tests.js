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

    var runTests = function (testSuite, targetDiv) {
        targetDiv.text("");

        var br = function () {
            return targetDiv.append($('<br/>'));
        };

        testSuite.run();

        $('<p>').addClass('error').text("Total tests: " + (testSuite.passedTests.length + testSuite.failedTests.length)).appendTo(targetDiv);

        br();

        // document.write("<span class='error'> Total tests: " + (testSuite.passedTests.length + testSuite.failedTests.length) + "</span></br>");
        // document.write("<br/>");
        if (testSuite.failedTests.length > 0) {
            $('<span>').addClass('error').text("Suite FAILURE: " + testSuite.failedTests.length + " tests failed. ").appendTo(targetDiv);

            //document.write("<span class='error'> Suite FAILURE: " + testSuite.failedTests.length + " tests failed. </span>");
            $('<span>').addClass('error').text("Check console after clicking on failed tests.").appendTo(targetDiv);
            br();
            br();
            // document.write("<span class='error'>Check console after  clicking on failed tests.</span><br/>");
            // document.write("<br/>");
        } else {
            $('<p>').addClass('success').text("Suite SUCCESS: All tests passed. ").appendTo(targetDiv);
            // document.write("<span class='success'> Suite SUCCESS: All tests passed. </span></br>");
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

            targetDiv.append($('<span>').addClass(styleClass).text("" + tr.testName + " : " + testStatus).on('click', function () {
                if (tr.error) {
                    tr.error.toConsole();
                } else {
                    console.log(tr.testName + "code: ", tr.test);
                }

                return false;
            }));
            targetDiv.append($('<span>').text(" Run again").addClass(styleClass).on('click', function () {
                console.error("TODO - quite useless right now....");
                var newTests = {};
                newTests[tr.testName] = tr.test;
                runTests(new TestSuite(newTests), targetDiv);
                return false;
            }));
            br();
        });
    };

    var testSuite = new TestSuite(stolangTest.tests);
    var targetDiv = $('<div>');
    runTests(testSuite, targetDiv);
    targetDiv.appendTo($("body"));
})(stolangTest || (stolangTest = {}));
//# sourceMappingURL=stolang-tests.js.map
