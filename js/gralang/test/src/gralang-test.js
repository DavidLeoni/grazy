define(["require", "exports", '../../main/src/gralang'], function (require, exports, gralang) {
    var Trees = gralang.Trees;
    var TestSuite = gralang.test.TestSuite;
    var assertEquals = gralang.test.assertEquals;
    var assertNotEquals = gralang.test.assertNotEquals;
    var report = gralang.report;
    var getCs = function (n) { return n.cs ? n.cs : []; };
    var sumCs = function (field, n, mcs) {
        console.log("inside sumCs  makeM: ", "parentField: ", field, "n: ", n, "cs: ", mcs, "mcs.toArray(): ", mcs);
        return mcs.length > 0 ?
            mcs.reduce(function (acc, el) {
                return acc + el;
            }, 0)
            : n;
    };
    exports.tests = {
        /** 'testMethodName' should be visualized in UI */
        testMethodName: function () { return null; },
        testAssertEquals_1: function () {
            var res = assertEquals(true, true);
            if (res) {
                return new gralang.NotEqErr(new Error(), null, res);
            }
            else {
                return null;
            }
        },
        testAssertEquals_2: function () {
            var res = assertEquals(true, false);
            if (res) {
                return null;
            }
            else {
                return new gralang.NotEqErr(new Error(), null, res);
            }
        },
        testAssertNotEquals_1: function () {
            var res = assertNotEquals(true, true);
            if (res) {
                return null;
            }
            else {
                return new gralang.EqErr(new Error(), res);
            }
        },
        testAssertNotEquals_2: function () {
            var res = assertNotEquals(true, false);
            if (res) {
                return new gralang.NotEqErr(new Error(), null, res);
            }
            else {
                return null;
            }
        },
        testGetCsType: function () { return assertEquals("array", $.type(getCs({ cs: [1, 2] }))); },
        testGetCsLength: function () { return assertEquals(2, getCs({ cs: [1, 2] }).length); },
        testGetCs_1: function () { return assertEquals(1, getCs({ cs: [1, 2] }).first()); },
        testGetCs_2: function () { return assertEquals(2, getCs({ cs: [1, 2] }).last()); },
        testEmptyTree: function () { return assertEquals(3, Trees.fold({}, function (n) { return []; }, function (n) { return 3; })); },
        // nodes can be either numbers or {cs:[...]}
        testSumOneNodeTree: function () { return assertEquals(3, Trees.fold({ cs: [1, 2] }, getCs, sumCs)); },
        // nodes can be either numbers or {cs:[...]}
        testSumManyNodesTree_1: function () { return assertEquals(1, Trees.fold({
            cs: [
                { cs: [1] }
            ]
        }, getCs, sumCs)); },
        // nodes can be either numbers or {cs:[...]}
        testSumManyNodesTree_2: function () { return assertEquals(6, Trees.fold({
            cs: [
                { cs: [1] },
                { cs: [2, 3] }
            ]
        }, getCs, sumCs)); },
        testHeight_0: function () { return assertEquals(0, Trees.height({}, getCs)); },
        testHeight_1: function () { return assertEquals(1, Trees.height({ cs: [{}] }, getCs)); },
        testHeight_2: function () { return assertEquals(2, Trees.height({
            cs: [{
                    cs: [{}
                    ]
                }]
        }, getCs)); },
        testHeight_3: function () { return assertEquals(3, Trees.height({
            cs: [{
                    cs: [{},
                        { cs: [{}] }
                    ]
                }]
        }, getCs)); },
    };
    var runTests = function (testSuite, targetDiv) {
        var br = function () { return targetDiv.append($('<br/>')); };
        targetDiv.text("");
        $('<h1>').text(testSuite.name + " tests")
            .appendTo(targetDiv);
        br();
        testSuite.run();
        // document.write("<span class='error'> Total tests: " + (testSuite.passedTests.length + testSuite.failedTests.length) + "</span></br>");
        // document.write("<br/>");
        var nFailedTests = testSuite.failedTests.length;
        if (nFailedTests > 0) {
            $('<h2>')
                .addClass('error')
                .addClass('suite-title')
                .text("Suite FAILURE: " + nFailedTests + " test" + (nFailedTests > 1 ? "s" : "") + " failed. ")
                .appendTo(targetDiv);
            //document.write("<span class='error'> Suite FAILURE: " + testSuite.failedTests.length + " tests failed. </span>");
            $('<h3>')
                .addClass('error')
                .text("Click on failed tests and check output in the console.")
                .appendTo(targetDiv);
        }
        else {
            $('<h2>')
                .addClass('success')
                .text("Suite SUCCESS: All tests passed. ")
                .appendTo(targetDiv);
        }
        $('<p>')
            .text("Total tests: " + testSuite.testResults.length)
            .appendTo(targetDiv);
        br();
        testSuite.testResults.forEach(function (tr) {
            var testStatus = null;
            var styleClass = null;
            if (tr.error) {
                testStatus = "FAILED";
                styleClass = "error clickable";
            }
            else {
                testStatus = "PASSED";
                styleClass = "success clickable";
            }
            targetDiv.append($('<span>')
                .addClass(styleClass)
                .text("" + tr.testName + " : " + testStatus)
                .on('click', function () {
                if (tr.error) {
                    tr.error.consoleError();
                }
                else {
                    console.log(tr.testName + "code: ", tr.test);
                }
                return false;
            }));
            targetDiv.append($('<span>').html("&nbsp;&nbsp;&nbsp;"));
            targetDiv.append($('<span>')
                .html("(Rerun)")
                .addClass(styleClass)
                .on('click', function () {
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
    var suiteName = "Gralang";
    if (singleTestName) {
        if (exports.tests[singleTestName]) {
            var boxedTest = {};
            boxedTest[singleTestName] = exports.tests[singleTestName];
            testSuite = new TestSuite(suiteName, boxedTest);
        }
        else {
            report(new Error(), "There is no test called " + singleTestName + " !!! Defaulting to all tests.");
            testSuite = new TestSuite(suiteName, exports.tests);
        }
    }
    else {
        testSuite = new TestSuite(suiteName, exports.tests);
    }
    var targetDiv = $('<div>');
    runTests(testSuite, targetDiv);
    targetDiv.appendTo($("body"));
});
//# sourceMappingURL=gralang-test.js.map