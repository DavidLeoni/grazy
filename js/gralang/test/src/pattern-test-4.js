define(["require", "exports", "../../main/src/defs", "./test-modules-4"], function (require, exports, g, test_modules_4_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var handler = {
        get: function (target, name) {
            if (name in target)
                return target[name];
            else {
                console.error("Couldn't find property ", name, "  !");
                return undefined;
            }
        },
        apply: function (target, thisArg, argArray) {
            return target;
        }
    };
    var mv = function (x) { return new Proxy(x, handler); };
    var match1 = function (arg1) {
        var patterns = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            patterns[_i - 1] = arguments[_i];
        }
        var res = arg1;
        return res + 1;
    };
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
    var myf = function (nums) {
        var X = mv(nums), XS = mv(nums);
        return match1(nums, [X, X + 4]);
    };
    exports.tests = {
        /** 'testMethodName' should be visualized in UI */
        test1: function () { return assertIs(myf(5), 6); }
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
//# sourceMappingURL=pattern-test-4.js.map