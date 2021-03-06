/// <reference path="../../js/org.nodejs/0.10.1/node.d.ts" />

var http = require('http');
var fs = require('fs');
var path = require('path');

http.createServer(function (request, response) {
    console.warn("***********   WARNING: THIS SERVER IS NOT TESTED WHATSOVER, JUST DON'T USE IT, NOT EVEN FOR DEBUGGING!!...*********");
    console.log('request starting...');

    var filePath = '.' + request.url;
    if (filePath == './')
        filePath = './index.htm';

    var extname = path.extname(filePath);
    var contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    path.exists(filePath, function(exists) {

        if (exists) {
            fs.readFile(filePath, function(error, content) {
                if (error) {
                    response.writeHead(500);
                    response.end();
                }
                else {
                    response.writeHead(200, { 'Content-Type': contentType });
                    response.end(content, 'utf-8');
                }
            });
        }
        else {
            response.writeHead(404);
            response.end();
        }
    });

}).listen(8125);
console.log('Server running at http://127.0.0.1:8125/');