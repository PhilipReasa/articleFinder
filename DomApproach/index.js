var express = require('express');
var jsdom = require("./node_modules/jsdom");
var fs = require("fs");
var articleFinderJS = fs.readFileSync("./articleFinder.js", "utf-8");


var app = express();
app.enable("jsonp callback");

app.get('/', function(req, res) {
    var urlToSearch = req.query.url;

    if(urlToSearch == null || urlToSearch == undefined || urlToSearch == "") {
        res.status("404").send("bad url");
        return;
    }

    jsdom.env({
        url: urlToSearch,
        src: [articleFinderJS],
        done: function (err, window) {
            if(err != null && err != undefined) {
                try {
                    window.close()
                } catch(e) {}
                res.status("404").send("error parsing document");
                return;
            }

            var data = window.ReaderArticleFinderJS.articleNode(true);
            if(data == undefined || data == null) {
                window.close();
                res.status("404").send("not able to find article");
            }

            res.setHeader("Content-Type", "application/javascript");
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