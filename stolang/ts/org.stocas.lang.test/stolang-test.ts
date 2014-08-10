/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />
/// <reference path="../ts/org.stocas.lang/stolang.ts" />

/*
* New TypeScript file
*/

module stolangTest {
    import Trees = stolang.Trees;
    import StoErr = stolang.StoErr;
    import Im = Immutable;



    export class EqErr extends StoErr {
        constructor(error : Error, expected, actual) {            
            super(error, "Failed assertion!",
                "  Expected ->", expected, "<-\n",
                "  Actual   ->", actual, "<-");
            this.expected = expected;
            this.actual = actual;
        }
        actual: any;
        expected: any;
    }

   
    class TestResult {
        testName : string
        test: any; // todo should be a method sig 
        error: StoErr;

        constructor(testName, test, error? : StoErr) {
            this.testName = testName;
            this.test = test;
            this.error = error;
        }
    }

    /**
     * @return null if no error occurred
     */
    var assertEquals = function(actual, expected): Error {
        var res = Im.is(actual, expected);
        if (res) {
            return null;
        } else {
            return new EqErr(new Error(), expected, actual);
        };
    };

    export var tests = {
        testEmptyTree() {
            return assertEquals(Trees.fold({}, (n) => null, (n) => 3), 3);
        },
        testError() {
            return assertEquals(true, false);
        }
    }

    var runTests = function() {
        var testResults: TestResult[] = [];
        var passedTests: TestResult[] = [];
        var failedTests: TestResult[] = [];

        for (var key in tests) {
            var stoerr: StoErr = null;
            try {
                stoerr = tests[key]();
            } catch (catchedError) {
                stoerr = new StoErr(catchedError, "Test threw an Error!");
            }
            var testRes = new TestResult(key, tests[key], stoerr);
            testResults.push(testRes);
            
            if (stoerr) {
                failedTests.push(testRes);
            } else {
                passedTests.push(testRes);
            }
        };

        document.write("<span class='error'> Total tests: " + (passedTests.length + failedTests.length) + "</span></br>");
        document.write("<br/>");
        if (failedTests.length > 0) {
            document.write("<span class='error'> Suite FAILURE: " + failedTests.length + " tests failed. </span>");
            document.write("<span class='error'>Check console after  clicking on failed tests.</span><br/>");
            document.write("<br/>");
        } else {
            document.write("<span class='success'> Suite SUCCESS: All tests passed. </span></br>");
        }

        testResults.forEach((tr) => {
            var testStatus = null;
            var styleClass = null;
            if (tr.error){
                testStatus = "FAILED";
                styleClass = "error clickable";                
            } else {
                testStatus = "PASSED";
                styleClass = "success clickable";
            }
            
            $("body").append($('<span>')
                .addClass(styleClass)
                .text("" + tr.testName + " : " + testStatus) 
                .on('click', () => { 
                    if (tr.error){
                        tr.error.toConsole();
                    } else {
                        console.log(tr.testName + "code: ", tr.test);
                    }
                      
                    return false; 
                 }));
            $("body").append($('<span>')
                .text(" Run again")
                .addClass(styleClass)                
                .on('click', () => { console.error('todo implement me!'); return false; }));
            $("body").append($('</br>'));
        });


    }
    
    runTests();
}

