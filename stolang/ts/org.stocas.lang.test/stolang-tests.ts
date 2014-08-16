/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />
/// <reference path="../ts/org.stocas.lang/stolang.ts" />

/*
* New TypeScript file
*/

module stolangTest {
    import Trees = stolang.Trees;
    import StoErr = stolang.StoErr;
    import Imm = Immutable;
    import TestResult = stolang.test.TestResult;
    import TestSuite = stolang.test.TestSuite;
    import assertEquals = stolang.test.assertEquals;
    import signal = stolang.signal;
  

    export var tests = {
        /** 'testMethodName' should be visualized in UI */
        testMethodName : ()=>null, 
        testEmptyTree() {
            return assertEquals(Trees.fold({}, 
                                (n) => [], 
                                (n) => 3), 
                                3);
        },
        // nodes can be either numbers or {cs:[...]}
        testSumOneNodeTree(){
            return assertEquals(Trees.fold({cs:[1,2]}, 
                                (n)=>n.cs ? <any> n.cs : [],
                                (n, mcs)=> mcs.length > 0 ?
                                            mcs.reduce((acc:number, el : number)=>{
                                                console.log("acc = ", acc, "el = ", el);
                                                return acc+el;
                                            })
                                            : n),
                                3);
        },
        // nodes can be either numbers or {cs:[...]}
        testSumManyNodesTree(){
            return assertEquals(Trees.fold({cs:[    
                                                {cs:[1]},
                                                {cs:[2,3]}
                                               ]}, 
                                (n)=>n.cs ? <any> n.cs : [],
                                (n, mcs)=> mcs.length > 0 ?
                                            mcs.reduce((acc:number, el : number)=>{
                                                console.log("acc = ", acc, "el = ", el);
                                                return acc+el;
                                            })
                                            : n),
                                6);
        }        
    }

  
    
    
    var runTests = function(testSuite : TestSuite, targetDiv) {                
        
        targetDiv.text("");
        
        var br = ()=>targetDiv.append($('<br/>'));
        
        
        testSuite.run();

        $('<p>')            
            .text( "Total tests: " + testSuite.testResults.length)
            .appendTo(targetDiv);
        
        br();
            
        // document.write("<span class='error'> Total tests: " + (testSuite.passedTests.length + testSuite.failedTests.length) + "</span></br>");
        // document.write("<br/>");
        if (testSuite.failedTests.length > 0) {
            $('<span>')
            .addClass('error')
            .text("Suite FAILURE: " + testSuite.failedTests.length + " tests failed. ")
            .appendTo(targetDiv);
            //document.write("<span class='error'> Suite FAILURE: " + testSuite.failedTests.length + " tests failed. </span>");
            $('<span>')
            .addClass('error')
            .text("Check console after clicking on failed tests.")
            .appendTo(targetDiv); 
            br();
            br();       
            // document.write("<span class='error'>Check console after  clicking on failed tests.</span><br/>");
            // document.write("<br/>");
        } else {
            $('<p>')
            .addClass('success')
            .text("Suite SUCCESS: All tests passed. ")
            .appendTo(targetDiv);            
            // document.write("<span class='success'> Suite SUCCESS: All tests passed. </span></br>");
        }

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
                        tr.error.toConsole();
                    } else {
                        console.log(tr.testName + "code: ", tr.test);
                    }

                    return false;
                }));
            targetDiv.append($('<span>')
                .text(" Run again")
                .addClass(styleClass)
                .on('click', () => {                     
                    window.location.href = window.location.pathname +  "?" + $.param({test:tr.testName});                     
                    return false;                  
                }));
            br();
        });


    }


    var getParameterByName = function(name) : string {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }    
    
    var singleTestName = getParameterByName("test");
    var  testSuite : TestSuite;
    if (singleTestName){
        if (tests[singleTestName]){
            var boxedTest = {};
            boxedTest[singleTestName] = tests[singleTestName];
            testSuite = new TestSuite(boxedTest);             
        } else {
            signal(new Error(), "There is no test called " + singleTestName + " !!! Defaulting to all tests.");
            testSuite = new TestSuite(tests);
        }
    } else {
        testSuite = new TestSuite(tests);
    }    
    
    var targetDiv = $('<div>');
    runTests(testSuite, targetDiv);
    targetDiv.appendTo($("body"));
}

