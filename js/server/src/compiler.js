define(["require", "exports", "typescript"], function (require, exports, ts) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var process;
    function compile(fileNames, options) {
        var program = ts.createProgram(fileNames, options);
        var emitResult = program.emit();
        var allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        allDiagnostics.forEach(function (diagnostic) {
            var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
            var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            console.log(diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + "): " + message);
        });
        var exitCode = emitResult.emitSkipped ? 1 : 0;
        console.log("Process exiting with code '" + exitCode + "'.");
        process.exit(exitCode);
    }
    exports.compile = compile;
    compile(process.argv.slice(2), {
        noEmitOnError: true, noImplicitAny: true,
        target: 1 /* ES5 */, module: 1 /* CommonJS */
    });
});
//# sourceMappingURL=compiler.js.map