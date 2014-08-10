/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />


declare module Rdfstore {

    export interface RDFEnvironment {
        resolve(url: string): string;
        filters: any;
    }

    export interface RDFNode {
        nominalValue: string;
        interfaceName: string;
        /**
            Returns the N-Triples representation of the RDFNode.
        */
        toNT(): string;
        equals(obj: any): boolean;
    }

    /**
        A node identified by an International Resource Identifier (IRI)
    */
    interface NamedNode extends RDFNode {
    }

    /**
        A BlankNode is a reference to an unnamed resource (one for which an IRI is not known), and may be used in a Triple as a unique reference to that unnamed resource.

        BlankNodes are stringified by prepending "_:" to a unique value, for instance _:b142 or _:me, this stringified form is referred to as a "blank node identifier".
    */
    interface BlankNode extends RDFNode {

        language?: string;
        datatype?: NamedNode;

    }



    export interface Base {
        create(callback: (store: Store) => void): void;
    }
    /* todo review, it might work now
    export interface Store {
        rdf: RDFEnvironment;        
        execute(query: string, callback: (success?, results?) => void);
        setPrefix(prefix: string, URIFragment: string);
        node(nodeURI: string, callback: (success, graph) => void);
        node(nodeURI : string, graphUri:string, callback: (success, graph)=>void);

    } */
    export interface Store {
        rdf: any;
        execute: any;
        setPrefix: any;
        node: any;


    }

    //function create : 
}

declare var rdfstore: Rdfstore.Base;

module stolang {
    import Imm = Immutable;
    export var STOCAS_PREFIX = "stocas";
    export var STOCAS_IRI = "https://github.com/davidleoni/stocas/";


    /**
     * This class encapsulates Javascript Error object. It doesn't extend it because all the error inheritance stuff 
     * in Javascript is really fucked up. 
     * 
     */
    export class StoErr {
        name: string;
        message: string;
        error: Error;
        params: any[];

        /**
         * You must pass a JavaScript Error so browser can keep track of stack execution. Message in original error is not considered.
         * Usage example: new StoErr(new Error(), "We got a problem!", "This object looks fishy: ", {a:666});  
         * @param message Overrides message in Error.         
         */
        constructor(error: Error, message, ...params) {
            // console.error.apply(null, params);      
            this.name = (<any>this.constructor).name;
            this.message = message;
            this.error = error;
            this.params = params;
        }

        toString() {
            return this.allParams().join("");
        }


        /**
         * Returns array with name, message plus all params
         */
        allParams(): any[] {
            var ret = this.params.slice(0)
            var afterMsg = "\n";
            if (this.params.length > 0) {
                afterMsg = "\n";
            }
            ret.unshift(this.message + afterMsg);
            ret.unshift(this.name + ":");
            return ret;
        }

        logToConsole(): void {
            console.log.apply(console, this.allParams());
            console.log(this.error);


        }

        toConsole(): void {
            var completeParams = this.allParams().slice(0);
            completeParams.push(" \n", this.error);
            console.error.apply(console, completeParams);
        }
    }

    /**
     * Visits nodes of type N and outputs type M
     */
    export interface TreeVisitor<N, M> {
        isLeaf(t: N): boolean;
        getChildren(t: N): Imm.Sequence<N, number>;
    }

    export class EqErr extends StoErr {
        constructor(error: Error, expected, actual) {
            super(error, "Failed assertion!",
                "  Expected ->", expected, "<-\n",
                "  Actual   ->", actual, "<-");
            this.expected = expected;
            this.actual = actual;
        }
        actual: any;
        expected: any;
    }


    export module test {
        /**
         * Doesn't throw any exception, 
         * @return null if no error occurred
        */
        export function assertEquals(actual, expected): StoErr {
            var res = Imm.is(actual, expected);
            if (res) {
                return null;
            } else {
                return new EqErr(new Error(), expected, actual);
            };
        };

        export class TestResult {
            testName: string
        test: any; // todo should be a method sig 
            error: StoErr;

            constructor(testName, test, error?: StoErr) {
                this.testName = testName;
                this.test = test;
                this.error = error;
            }
        }

        export class TestSuite {
            tests: any;
            testResults: TestResult[];
            passedTests: TestResult[];
            failedTests: TestResult[];

            constructor (tests) {
                this.testResults = [];
                this.passedTests = [];
                this.failedTests = [];
                this.tests = tests;
            }

            run() {
                this.testResults = [];
                this.passedTests = [];
                this.failedTests = [];

                for (var key in this.tests) {
                    var stoerr: StoErr = null;
                    try {
                        stoerr = this.tests[key]();
                    } catch (catchedError) {
                        stoerr = new StoErr(catchedError, "Test threw an Error!");
                    }
                    var testRes = new TestResult(key, this.tests[key], stoerr);
                    this.testResults.push(testRes);

                    if (stoerr) {
                        this.failedTests.push(testRes);
                    } else {
                        this.passedTests.push(testRes);
                    }
                }

            }
        }
    }






    export class Trees {
        /**
         * @param getChildren if null node is a leaf
         */
        static fold<N, M>(rootNode: N,
            /** if null node is considered a leaf */
            getChildren: (t: N) => N[],
            makeM: (t: N, children: M[]) => M): M {


            var stack1 = [rootNode];
            var stack2: {
                node: N;
                neededChildren: number;
                children: M[]
            }[] = [];


            /**
                inserts node to existing children. If children list is full,
                resolves expressions popping nodes in stack2 until meets a list with not enough children  
            */
            var nodeToStack2 = (node: N): M => {
                var toInsert = makeM(node, []);

                while (stack2.length > 0) {

                    var top2 = stack2[0];
                    top2.children.unshift(toInsert);

                    if (top2.neededChildren == stack2[0].children.length) {
                        var poppedTop2 = stack2.pop();
                        toInsert = makeM(poppedTop2.node, poppedTop2.children);
                    } else {
                        return toInsert;
                    }
                }

                return toInsert;

            }

            var ret: M;

            while (stack1.length > 0) {
                var el = stack1.pop();
                var children = getChildren(el);

                // non-leaf node                                                
                if (children == null || children.length == 0) {
                    ret = nodeToStack2(el);
                    if (stack2.length == 0) {
                        return ret;
                    }
                } else {
                    $.each(children, (i, c) => {
                        stack1.unshift(c);
                    });
                    stack2.unshift({
                        node: el,
                        neededChildren: children.length,
                        children: []
                    });
                }

            }

            throw new Error("Shouldn't arrive till here...");
            return makeM(null, []);
        }

    }

}

