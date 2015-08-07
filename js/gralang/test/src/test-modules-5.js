define(["require", "exports", 'test-modules-4'], function (require, exports, test_modules_4_1) {
    test_modules_4_1.default.Trials.println("Maybe I did it!");
    var t = test_modules_4_1.default.Trial();
    console.log("trial is ", t);
    // bah does not work var t1 : nice.Trial = nice.Trial();
    // this doesn't work, why??
    // var ts  : nice.Trials = nice.Trials;
    var Ts = test_modules_4_1.default.Trials;
    Ts.println("hello");
});
//# sourceMappingURL=test-modules-5.js.map