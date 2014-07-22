declare module tsUnit {
    interface ITestClass {
    }
    class Test {
        private tests;
        private testClass;
        public addTestClass(testClass: ITestClass, name?: string): void;
        public isReservedFunctionName(functionName: string): boolean;
        public run(): TestResult;
        public showResults(target: HTMLElement, result: TestResult): void;
        private getTestResult(result);
        private getTestSummary(result);
        private getTestResultList(testResults);
        private encodeHtmlEntities(input);
    }
    class TestContext {
        public setUp(): void;
        public tearDown(): void;
        public areIdentical(a: any, b: any): void;
        public areNotIdentical(a: any, b: any): void;
        public isTrue(a: boolean): void;
        public isFalse(a: boolean): void;
        public isTruthy(a: any): void;
        public isFalsey(a: any): void;
        public throws(a: () => void): void;
        public fail(): void;
    }
    class TestClass extends TestContext {
    }
    class FakeFunction {
        public name: string;
        public delgate: (...args: any[]) => any;
        constructor(name: string, delgate: (...args: any[]) => any);
    }
    class Fake {
        constructor(obj: any);
        public create(): any;
        public addFunction(name: string, delegate: (...args: any[]) => any): void;
        public addProperty(name: string, value: any): void;
    }
    class TestDescription {
        public testName: string;
        public funcName: string;
        public message: string;
        constructor(testName: string, funcName: string, message: string);
    }
    class TestResult {
        public passes: TestDescription[];
        public errors: TestDescription[];
    }
}
