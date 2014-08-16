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
  
    var getCs = (n)=>n.cs ? <any[]> n.cs : [];
    var sumCs = (n, mcs)=> mcs.length > 0 ?
                                            mcs.reduce((acc:number, el : number)=>{
                                                console.log("acc = ", acc, "el = ", el);
                                                return acc+el;
                                            })
                                            : n;
    
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
        testSumManyNodesTree_1(){
            return assertEquals(Trees.fold({cs:[
                                                {cs:[1]}
                                               ]}, 
                                                getCs,
                                                sumCs),
                                1);
        },        
        
        // nodes can be either numbers or {cs:[...]}
        testSumManyNodesTree_2(){
            return assertEquals(Trees.fold({cs:[    
                                                {cs:[1]},
                                                {cs:[2,3]}
                                               ]}, 
                                getCs,
                                sumCs),
                                6);
        },
        testHeight_0 : ()=>assertEquals(Trees.height(<any> {}, getCs), 0),
        testHeight_1 : ()=>assertEquals(Trees.height(<any> {cs:[{}]}, getCs), 1),
        testHeight_2 : ()=>assertEquals(Trees.height(<any> {cs:[{cs: [{}
                                                                     ]
                                                                }]}, getCs), 2),
        testHeight_3 : ()=>assertEquals(Trees.height(<any> {cs:[{cs: [{},
                                                                      {cs: [{}]}
                                                                     ]
                                                                }]}, getCs), 3)     
    }

  
    
    
    var runTests = function(testSuite : TestSuite, targetDiv) {                                    
                
        var br = ()=>targetDiv.append($('<br/>'));
        
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
            .text( "Total tests: " + testSuite.testResults.length)
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
                        tr.error.toConsole();
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
    var suiteName = "Stolang";
    if (singleTestName){
        if (tests[singleTestName]){
            var boxedTest = {};
            boxedTest[singleTestName] = tests[singleTestName];
            testSuite = new TestSuite(suiteName, boxedTest);             
        } else {
            signal(new Error(), "There is no test called " + singleTestName + " !!! Defaulting to all tests.");
            testSuite = new TestSuite(suiteName, tests);
        }
    } else {
        testSuite = new TestSuite(suiteName,tests);
    }    
    
    var targetDiv = $('<div>');
    runTests(testSuite, targetDiv);
    targetDiv.appendTo($("body"));
}

