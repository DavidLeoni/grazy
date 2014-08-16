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
    var signal = stolang.signal;

    var getCs = function (n) {
        return n.cs ? n.cs : [];
    };
    var sumCs = function (n, mcs) {
        return mcs.length > 0 ? mcs.reduce(function (acc, el) {
            console.log("acc = ", acc, "el = ", el);
            return acc + el;
        }) : n;
    };

    stolangTest.tests = {
        /** 'testMethodName' should be visualized in UI */
        testMethodName: function () {
            return null;
        },
        testEmptyTree: function () {
            return assertEquals(Trees.fold({}, function (n) {
                return [];
            }, function (n) {
                return 3;
            }), 3);
        },
        // nodes can be either numbers or {cs:[...]}
        testSumOneNodeTree: function () {
            return assertEquals(Trees.fold({ cs: [1, 2] }, function (n) {
                return n.cs ? n.cs : [];
            }, function (n, mcs) {
                return mcs.length > 0 ? mcs.reduce(function (acc, el) {
                    console.log("acc = ", acc, "el = ", el);
                    return acc + el;
                }) : n;
            }), 3);
        },
        // nodes can be either numbers or {cs:[...]}
        testSumManyNodesTree_1: function () {
            return assertEquals(Trees.fold({ cs: [
                    { cs: [1] }
                ] }, getCs, sumCs), 1);
        },
        // nodes can be either numbers or {cs:[...]}
        testSumManyNodesTree_2: function () {
            return assertEquals(Trees.fold({ cs: [
                    { cs: [1] },
                    { cs: [2, 3] }
                ] }, getCs, sumCs), 6);
        },
        testHeight_0: function () {
            return assertEquals(Trees.height({}, getCs), 0);
        },
        testHeight_1: function () {
            return assertEquals(Trees.height({ cs: [{}] }, getCs), 1);
        },
        testHeight_2: function () {
            return assertEquals(Trees.height({ cs: [{
                        cs: [
                            {}
                        ]
                    }] }, getCs), 2);
        },
        testHeight_3: function () {
            return assertEquals(Trees.height({ cs: [{
                        cs: [
                            {},
                            { cs: [{}] }
                        ]
                    }] }, getCs), 3);
        }
    };

    var runTests = function (testSuite, targetDiv) {
        var br = function () {
            return targetDiv.append($('<br/>'));
        };

        targetDiv.text("");

        $('<h1>').text(testSuite.name + " tests").appendTo(targetDiv);
        br();

        testSuite.run();

        // document.write("<span class='error'> Total tests: " + (testSuite.passedTests.length + testSuite.failedTests.length) + "</span></br>");
        // document.write("<br/>");
        var nFailedTests = testSuite.failedTests.length;

        if (nFailedTests > 0) {
            $('<h2>').addClass('error').addClass('suite-title').text("Suite FAILURE: " + nFailedTests + " test" + (nFailedTests > 1 ? "s" : "") + " failed. ").appendTo(targetDiv);

            //document.write("<span class='error'> Suite FAILURE: " + testSuite.failedTests.length + " tests failed. </span>");
            $('<h3>').addClass('error').text("Click on failed tests and check output in the console.").appendTo(targetDiv);
            // document.write("<span class='error'>Check console after  clicking on failed tests.</span><br/>");
            // document.write("<br/>");
        } else {
            $('<h2>').addClass('success').text("Suite SUCCESS: All tests passed. ").appendTo(targetDiv);
            // document.write("<span class='success'> Suite SUCCESS: All tests passed. </span></br>");
        }

        $('<p>').text("Total tests: " + testSuite.testResults.length).appendTo(targetDiv);
        br();

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
            targetDiv.append($('<span>').html("&nbsp;&nbsp;&nbsp;"));
            targetDiv.append($('<span>').html("(Rerun)").addClass(styleClass).on('click', function () {
                window.location.href = window.location.pathname + "?" + $.param({ test: tr.testName });
                return false;
            }));
            br();
        });
    };

    var getParameterByName = function (name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"), results = regex.exec(location.search);
        return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    };

    var singleTestName = getParameterByName("test");
    var testSuite;
    var suiteName = "Stolang";
    if (singleTestName) {
        if (stolangTest.tests[singleTestName]) {
            var boxedTest = {};
            boxedTest[singleTestName] = stolangTest.tests[singleTestName];
            testSuite = new TestSuite(suiteName, boxedTest);
        } else {
            signal(new Error(), "There is no test called " + singleTestName + " !!! Defaulting to all tests.");
            testSuite = new TestSuite(suiteName, stolangTest.tests);
        }
    } else {
        testSuite = new TestSuite(suiteName, stolangTest.tests);
    }

    var targetDiv = $('<div>');
    runTests(testSuite, targetDiv);
    targetDiv.appendTo($("body"));
})(stolangTest || (stolangTest = {}));
//# sourceMappingURL=stolang-tests.js.map
