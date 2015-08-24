
import * as g from '../../main/src/defs';

// notice writing import * as nice does NOT work!!

import nice from './test-modules-4'


let Trees = g.Trees;
let Nats = g.Nats;
let List = g.List;
let Err = g.Err;
let Obj = g.Obj;
let TestSuite = g.test.TestSuite;
let assertIs = g.test.assertIs;
let assertNotIs = g.test.assertNotIs;
let assertEq = g.test.assertEq;
let assertNotEq = g.test.assertNotEq;


let report = g.report;

let t : g.Nil = g.nil; 


declare var $: any; // as elegant as it can be

export var testGralang = g;
export var testNice = nice;

var getCs = (n) => n.cs ? n.cs : [];
var sumCs = (field, n, mcs: number[]): number => {
    console.log("inside sumCs  makeM: ", "parentField: ", field, "n: ", n, "cs: ", mcs, "mcs.toArray(): ", mcs);
    return mcs.length > 0 ?
        mcs.reduce((acc: number,
            el: number) => {
            return acc + el;
        }, 0)
        : n;
}

export var tests = {
    /** 'testMethodName' should be visualized in UI */
    testMethodName: () => null,    
    testAssertIs_1: () => {
        var res = assertIs(true, true);
        if (res) {
            return new g.NotEqErr(new Error(), null, res);
        } else {
            return null;
        }
    },
    testAssertIs_2: () => {
        var res = assertIs(true, false);
        if (res) {
            return null;
        } else {
            return new g.NotEqErr(new Error(), null, res);
        }
    },
    testAssertNotIs_1: () => {
        var res = assertNotIs(true, true);
        if (res) {
            return null;
        } else {
            return new g.EqErr(new Error(), res);
        }
    },
    testAssertNotIs_2: () => {
        var res = assertNotIs(true, false);
        if (res) {
            return new g.NotEqErr(new Error(), null, res);
        } else {
            return null;
        }
    },
    testEq_1: () => {
        var res = g.eq(g.Objs.empty, g.Objs.empty);
        if (res) {
            return null;
        } else {
            return new g.NotEqErr(new Error(), true, res);
        }
    },
    testEq_2: () => {
        var res = g.eq(g.Objs.empty, Nats.zero);
        if (res) {
            return new g.NotEqErr(new Error(), false, res);            
        } else {
            return null;
        }
    },    
    testAssertEq_1: () => {
        var res = assertEq(g.Objs.empty, g.Objs.empty);
        if (res) {
            return new g.NotEqErr(new Error(), null, res);
        } else {
            return null;
        }
    },
    testAssertEq_2: () => {
        var res = assertEq(g.Objs.empty, Nats.zero);
        if (res) {
            return null;
        } else {
            return new g.NotEqErr(new Error(), "Instance of an error!", res);
        }
    },
    testAssertNotEq_1: () => {
        var res = assertNotEq(g.Objs.empty, g.Objs.empty);
        if (res) {
            return null;
        } else {
            return new g.EqErr(new Error(), res);
        }
    },
    testAssertNotEq_2: () => {
        var res = assertNotEq(g.Objs.empty, Nats.zero);
        if (res) {
            return new g.NotEqErr(new Error(), null, res);
        } else {
            return null;
        }
    },    
    
    testModuleImport: () => assertIs("a", nice.Trial("a").sing()),
        
    testGetCsType: () => assertIs("array", $.type(getCs({ cs: [1, 2] }))),
    testGetCsLength: () => assertIs(2, getCs({ cs: [1, 2] }).length),
    testGetCs_1: () => assertIs(1, getCs({ cs: [1, 2] }).first()),
    testGetCs_2: () => assertIs(2, getCs({ cs: [1, 2] }).last()),
    testZeroPlusZero: ()=> assertEq(Nats.zero, Nats.zero.plus(Nats.zero)),
    testZeroPlusOne: ()=> assertEq(Nats.one, Nats.zero.plus(Nats.one)),
    testEmptyTree: () => assertIs(3,
        Trees.fold({},
            (n) => [],
            (n) => 3)),
    // nodes can be either numbers or {cs:[...]}
    testSumOneNodeTree: () => assertIs(3, Trees.fold({ cs: [1, 2] },
        getCs,
        sumCs)),
    // nodes can be either numbers or {cs:[...]}
    testSumManyNodesTree_1: () => assertIs(1,
        Trees.fold({
            cs: [
                { cs: [1] }
            ]
        },
            getCs,
            sumCs)),

    // nodes can be either numbers or {cs:[...]}
    testSumManyNodesTree_2: () => assertIs(6,
        Trees.fold({
            cs: [
                { cs: [1] },
                { cs: [2, 3] }
            ]
        },
            getCs,
            sumCs)),
    testHeight_0: () => assertIs(0, Trees.height({}, getCs)),
    testHeight_1: () => assertIs(1, Trees.height({ cs: [{}] }, getCs)),
    testHeight_2: () => assertIs(2, Trees.height({
        cs: [{
            cs: [{}
            ]
        }]
    }, getCs)),
    testHeight_3: () => assertIs(3, Trees.height({
        cs: [{
            cs: [{},
                { cs: [{}] }
            ]
        }]
    }, getCs)),

}




var runTests = function(testSuite: g.test.TestSuite, targetDiv) {

    var br = () => targetDiv.append($('<br/>'));

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
    } else {
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

    testSuite.testResults.forEach((tr) => {
        var testStatus = null;
        var styleClass = null;
        if (tr.error) {
            testStatus = "FAILED";
            styleClass = "error clickable";
        } else {
            testStatus = "PASSED";
            styleClass = "success clickable";
        }

        targetDiv.append($('<span>')
            .addClass(styleClass)
            .text("" + tr.testName + " : " + testStatus)
            .on('click', () => {
                if (tr.error) {
                    tr.error.consoleError();
                } else {
                    console.log(tr.testName + "code: ", tr.test);
                }

                return false;
            }));
        targetDiv.append($('<span>').html("&nbsp;&nbsp;&nbsp;"));
        targetDiv.append($('<span>')
            .html("(Rerun)")
            .addClass(styleClass)
            .on('click', () => {
                window.location.href = window.location.pathname + "?" + $.param({ test: tr.testName });
                return false;
            }));
        br();
    });


}


var getParameterByName = function(name): string {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

var singleTestName = getParameterByName("test");
var testSuite: g.test.TestSuite;
var suiteName = "Gralang";
if (singleTestName) {
    if (tests[singleTestName]) {
        var boxedTest = {};
        boxedTest[singleTestName] = tests[singleTestName];
        testSuite = new TestSuite(suiteName, boxedTest);
    } else {
        report(new Error(), "There is no test called " + singleTestName + " !!! Defaulting to all tests.");
        testSuite = new TestSuite(suiteName, tests);
    }
} else {
    testSuite = new TestSuite(suiteName, tests);
}

var targetDiv = $('<div>');
runTests(testSuite, targetDiv);
targetDiv.appendTo($("body"));
