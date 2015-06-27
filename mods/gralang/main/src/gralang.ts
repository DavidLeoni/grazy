


  // todo little hack for having ES6 fuinctions
  declare var Object : any;


  export var GRAZY_PREFIX = 'grazy';
  export var GRAZY_IRI = 'https://github.com/DavidLeoni/grazy/';




  /**
   * Usage: callConstructor(MyConstructor, arg1, arg2);
   */
  export var callConstructor = function(constr) {
      var factoryFunction = constr.bind.apply(constr, arguments);
      return new factoryFunction();

  };

  /**
      Immutable. Adopts JsonLD tags.
  */
  export class GraphNode {
      "@id" : string;
      "@reverse" : {[key:string]: GraphNode[]};
  }

  export var EmptyGraph : GraphNode = {
      "@id" : GRAZY_IRI + "empty-node",
      "@reverse" : <any>[]
  };


  /**
   * Usage: applyToConstructor(MyConstructor, [arg1, arg2]);
   */
  export var applyToConstructor = function(constr, argArray) {
      var args = [null].concat(argArray);
      var factoryFunction = constr.bind.apply(constr, args);
      return new factoryFunction();
  };

  /**
   * This class encapsulates Javascript Error object. It doesn't extend it because all the error inheritance stuff
   * in Javascript is really fucked up.
   *
   */
  export class GrazyErr {
      name: string;
      message: string;
      error: Error;
      params: any[];

      /**
       * You must pass a JavaScript Error so browser can keep track of stack execution. Message in original error is not considered.
       * Usage example: new GrazyErr(new Error(), "We got a problem!", "This object looks fishy: ", {a:666});
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

      /** Reports the error to console with console.log */
      consoleLog(): void {
          console.log.apply(console, this.allParams());
          console.log(this.error);


      }

      /** Reports the error to console with console.error */
      consoleError(): void {
          var completeParams = this.allParams().slice(0);
          completeParams.push(" \n", this.error);
          console.error.apply(console, completeParams);
      }
  }

  export class EqErr extends GrazyErr {
      constructor(error: Error, actual) {
          super(error, "Failed assertion!",
              "  Expected something different than ->", actual, "<-\n");
          this.actual = actual;
      }
      actual: any;
  }

  export class NotEqErr extends GrazyErr {
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


  /**
   * Takes a variable number of arguments and displays them as concatenated strings in an alert message, plus it calls console.error with the same arguments. Usage example:
   * signal(new Error(), "We got a problem", "Expected: ", 3, " got:", 2 + 2);
   * @returns {GrazyErr}
   */
  export var report = function(error: Error, ...args) {
      var i;
      var arr = [];
      for (i = 0; i < arguments.length; i++) {
          arr.push(arguments[i]);
      }
      var exc = applyToConstructor(GrazyErr, arr);

      exc.toConsole();
      alert(exc.toString() + "\n\nLook in the console for more details.");
      return exc;
  };



  /**
   * Visits nodes of type N and outputs type M
   */
  export interface TreeVisitor<N, M> {
      getChildren(t: N): N[];
  }



  export module test {

      /**azy
       * Returns EqErr in case actual is equals to notExpected.
       * Doesn't throw any exception
       * @return null if no error occurred
      */
      export function assertNotEquals(notExpected, actual): GrazyErr {
          var res = Object.is(actual, notExpected);
          if (res) {
              return new EqErr(new Error(), actual);
          } else {
              return null;
          };
      };

      /**
       * Doesn't throw any exception,
       * @return null if no error occurred
      */
      export function assertEquals(expected, actual): GrazyErr {
          var res = Object.is(actual, expected);
          if (res) {
              return null;
          } else {
              return new NotEqErr(new Error(), expected, actual);
          };
      };

      export class TestResult {
          testName: string
      test: any; // todo should be a method sig
          error: GrazyErr;

          constructor(testName, test, error?: GrazyErr) {
              this.testName = testName;
              this.test = test;
              this.error = error;
          }
      }

      export class TestSuite {
          tests: any;
          name: string;
          testResults: TestResult[];
          passedTests: TestResult[];
          failedTests: TestResult[];

          constructor(name: string, tests) {
              this.testResults = [];
              this.passedTests = [];
              this.failedTests = [];
              this.name = name;
              this.tests = tests;
          }

          run() {
              this.testResults = [];
              this.passedTests = [];
              this.failedTests = [];

              for (var key in this.tests) {
                  var grazyErr: GrazyErr = null;
                  try {
                      grazyErr = this.tests[key]();
                  } catch (catchedError) {
                      if (catchedError instanceof GrazyErr) {
                          grazyErr = catchedError;
                      } else {
                          grazyErr = new GrazyErr(catchedError, "Test threw an Error!");
                      }
                  }
                  var testRes = new TestResult(key, this.tests[key], grazyErr);
                  this.testResults.push(testRes);

                  if (grazyErr) {
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
       * Recursively applies function makeM to a node of type N and
       * M-fied children of type M, so the resulting tree will have type M
       * @param getChildren leaf nodes have zero children
       * @param makeM function that takes node to M-ify,
       *        the field name (or index) that was holding it
       *        and its now M-fied children
       */
      static fold<N, M>(rootNode: N,
          getChildren: (t: N) => N[],
          makeM: (field, t: N, children: M[]) => M): M {

          var processedNodesCounter = 0;

          /** Holds original nodes */
          var stack1 = [{
              key: null,
              node: rootNode
          }]; // only rootNode should have null as key

          /** Holds nodes-as-expressions that still need to be completely filled with
            M-fied children */
          var stack2: {
              key: any;
              node: N;
              neededChildren: number;
              children: any[]; //[<any, M>]
          }[] = [];


          /**
              Inserts node to existing children container in top entry of stack2.
              If inserting the node fills the children container,
              resolves expressions popping nodes in stack2. If stack2 gets empty
              returns last calculated expression, otherwise return null.
          */
          var nodeToStack2 = (key: any, node: N): M => {

              var toInsert = makeM(key,
                  node,
                  []);
              var curKey = key;

              while (stack2.length > 0) {

                  var top2 = stack2[0];

                  top2.children.unshift([curKey, toInsert]);

                  if (top2.children.length > top2.neededChildren) {
                      throw new GrazyErr(new Error(), "Found more children in top2 than the needed ones!",
                          "stack1: ", stack1, "top2 =", top2, "stack2: ", stack2);
                  }

                  if (top2.neededChildren === top2.children.length) {
                      stack2.shift();


                      toInsert = makeM(top2.key, top2.node, top2.children);
                      curKey = top2.key;
                  } else {
                      return null;
                  }

              }


              return toInsert; // stack2.length = 0

          }

          var ret: M;


          while (stack1.length > 0) {

              var el = stack1.shift();

              var children = getChildren(el.node);


              if (children.length === 0) { // leaf node
                  ret = nodeToStack2(el.key, el.node);
                  if (stack1.length === 0) {
                      if (stack2.length > 0){
                          throw new GrazyErr(new Error(), "Found non-empty stack2: ", stack2);
                      }
                      return ret;
                  } else {
                      if (stack2.length === 0){
                          return ret;
                      } else {
                          if (ret){
                              throw new GrazyErr(new Error(), "ret should be null, found instead ", ret);
                          }
                      }
                  }
              } else {  // non-leaf nosde
                  children.forEach((c, k) => {
                      stack1.unshift({
                          node: c,
                          key: k
                      });
                  });
                  var childrenContainer = [];
                  var toStack2 = {
                      node: el.node,
                      key: el.key,
                      neededChildren: children.length,
                      children: childrenContainer
                  };
                  stack2.unshift(toStack2);
              }

          }

          throw new Error("Shouldn't arrive till here...");

          return makeM(null, null, null);
      }

      static height<N>(node: N,
          getChildren: (t: N) => N[]): number {
          return Trees.fold(node, getChildren, (parentField, n, cs: number[]) => {
              return cs.length === 0 ?
                  0
                  : Math.max.apply(null, cs) + 1;
          })
      }

  }
