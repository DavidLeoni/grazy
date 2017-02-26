define(["require", "exports", "../../main/src/defs", "./test-modules-4"], function (require, exports, g, test_modules_4_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Trees = g.Trees;
    var Nats = g.Nats;
    var List = g.List;
    var Err = g.Err;
    var Obj = g.Obj;
    var TestSuite = g.test.TestSuite;
    var assertIs = g.test.assertIs;
    var assertNotIs = g.test.assertNotIs;
    var assertEq = g.test.assertEq;
    var assertNotEq = g.test.assertNotEq;
    var report = g.report;
    var t = g.nil;
    exports.testGralang = g;
    exports.testNice = test_modules_4_1.default;
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
        testAssertIs_1: function () {
            var res = assertIs(true, true);
            if (res) {
                return new g.NotEqErr(new Error(), null, res);
            }
            else {
                return null;
            }
        },
        testAssertIs_2: function () {
            var res = assertIs(true, false);
            if (res) {
                return null;
            }
            else {
                return new g.NotEqErr(new Error(), null, res);
            }
        },
        testAssertNotIs_1: function () {
            var res = assertNotIs(true, true);
            if (res) {
                return null;
            }
            else {
                return new g.EqErr(new Error(), res);
            }
        },
        testAssertNotIs_2: function () {
            var res = assertNotIs(true, false);
            if (res) {
                return new g.NotEqErr(new Error(), null, res);
            }
            else {
                return null;
            }
        },
        testEq_1: function () {
            var res = g.eq(g.Objs.empty, g.Objs.empty);
            if (res) {
                return null;
            }
            else {
                return new g.NotEqErr(new Error(), true, res);
            }
        },
        testEq_2: function () {
            var res = g.eq(g.Objs.empty, Nats.zero);
            if (res) {
                return new g.NotEqErr(new Error(), false, res);
            }
            else {
                return null;
            }
        },
        testAssertEq_1: function () {
            var res = assertEq(g.Objs.empty, g.Objs.empty);
            if (res) {
                return new g.NotEqErr(new Error(), null, res);
            }
            else {
                return null;
            }
        },
        testAssertEq_2: function () {
            var res = assertEq(g.Objs.empty, Nats.zero);
            if (res) {
                return null;
            }
            else {
                return new g.NotEqErr(new Error(), "Instance of an error!", res);
            }
        },
        testAssertNotEq_1: function () {
            var res = assertNotEq(g.Objs.empty, g.Objs.empty);
            if (res) {
                return null;
            }
            else {
                return new g.EqErr(new Error(), res);
            }
        },
        testAssertNotEq_2: function () {
            var res = assertNotEq(g.Objs.empty, Nats.zero);
            if (res) {
                return new g.NotEqErr(new Error(), null, res);
            }
            else {
                return null;
            }
        },
        testModuleImport: function () { return assertIs("a", test_modules_4_1.default.Trial("a").sing()); },
        testGetCsType: function () { return assertIs("array", $.type(getCs({ cs: [1, 2] }))); },
        testGetCsLength: function () { return assertIs(2, getCs({ cs: [1, 2] }).length); },
        testGetCs_1: function () { return assertIs(1, getCs({ cs: [1, 2] }).first()); },
        testGetCs_2: function () { return assertIs(2, getCs({ cs: [1, 2] }).last()); },
        testZeroPlusZero: function () { return assertEq(Nats.zero, Nats.zero.plus(Nats.zero)); },
        testZeroPlusOne: function () { return assertEq(Nats.one, Nats.zero.plus(Nats.one)); },
        testEmptyTree: function () { return assertIs(3, Trees.fold({}, function (n) { return []; }, function (n) { return 3; })); },
        // nodes can be either numbers or {cs:[...]}
        testSumOneNodeTree: function () { return assertIs(3, Trees.fold({ cs: [1, 2] }, getCs, sumCs)); },
        // nodes can be either numbers or {cs:[...]}
        testSumManyNodesTree_1: function () { return assertIs(1, Trees.fold({
            cs: [
                { cs: [1] }
            ]
        }, getCs, sumCs)); },
        // nodes can be either numbers or {cs:[...]}
        testSumManyNodesTree_2: function () { return assertIs(6, Trees.fold({
            cs: [
                { cs: [1] },
                { cs: [2, 3] }
            ]
        }, getCs, sumCs)); },
        testHeight_0: function () { return assertIs(0, Trees.height({}, getCs)); },
        testHeight_1: function () { return assertIs(1, Trees.height({ cs: [{}] }, getCs)); },
        testHeight_2: function () { return assertIs(2, Trees.height({
            cs: [{
                    cs: [{}
                    ]
                }]
        }, getCs)); },
        testHeight_3: function () { return assertIs(3, Trees.height({
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
            // document.write("<span class='error'>Check console after  clicking on failed tests.</span><br/>");
            // document.write("<br/>");
        }
        else {
            $('<h2>')
                .addClass('success')
                .text("Suite SUCCESS: All tests passed. ")
                .appendTo(targetDiv);
            // document.write("<span class='success'> Suite SUCCESS: All tests passed. </span></br>");
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