var express = require('express');
var jsdom = require("./node_modules/jsdom");
var fs = require("fs");
var articleFinderJS = fs.readFileSync("./articleFinder.js", "utf-8");


var app = express();
app.enable("jsonp callback");

app.get('/', function(req, res) {
    var urlToSearch = req.query.url;
    console.log(urlToSearch);
    jsdom.env({
        url: urlToSearch,
        src: [articleFinderJS],
        done: function (err, window) {
            console.log(err);
            var data = window.ReaderArticleFinderJS.articleNode(true);
            res.setHeader("Content-Type", "application/javascript")
            res.jsonp({html: data.outerHTML});
            window.close();
        }
    });
});


var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});