

var handler : ProxyHandler<any> = {
    get: function(target, name){
        if (name in target)
            return target[name];
        else {
            console.error("Couldn't find property ", name, "  !" );
            return undefined;
        }       
    },
    apply : function(target: any, thisArg: any, argArray?: any): any {
        return target;
     }
};

interface ExprConstructor {
    revocable<T>(target: T, handler: ProxyHandler<T>): { proxy: T; revoke: () => void; };
    new <T>(target: T, handler: ProxyHandler<T>): T
}

declare var ExprProxy: ExprConstructor;


let mv = <T>(x:T):T => new Proxy<T>(x, handler);

var  match1 = function<TIn,TOut>(
    arg1 : TIn,
    ...patterns : [TIn, TOut][]
    ) : TOut{

    let res = arg1;

    return <any> res + 1;

}


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


let myf = function(nums : number){

    let X = mv(nums),
        XS = mv(nums);

    return match1(
        nums, 
        [X, X + 4])

} 

export var tests = {
    /** 'testMethodName' should be visualized in UI */
    test1: () =>  assertIs(myf(5), 6) 

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
