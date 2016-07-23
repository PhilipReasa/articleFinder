var express = require('express');
var jsdom = require("jsdom");
var fs = require("fs");
var articleFinderJS = fs.readFileSync("./articleFinder.js", "utf-8");


var app = express();
app.enable("jsonp callback");

app.get('/', function(req, res) {
    var urlToSearch = req.query.url;

    if(urlToSearch === null || urlToSearch === undefined || urlToSearch === "") {
        res.status("404").send("bad url");
        return;
    }

    jsdom.env({
        url: urlToSearch,
        src: [articleFinderJS],
        done: function (err, window) {
            //handle error case on loading page
            if(err !== null && err !== undefined) {
                try {
                    window.close()
                } catch(e) {}
                res.status("404").send("error parsing document");
                return;
            }

            //attempt to pull the content out of the page
            var data = window.ReaderArticleFinderJS.articleNode(true);

            //handle error case (no article found)
            if(data == undefined || data == null) {
                window.close();
                res.status("404").send("not able to find article");
                return;
            }

            //respond with the results :)
            res.setHeader("Content-Type", "application/javascript");
            res.jsonp({html: data.outerHTML});
            window.close();
        }
    });
});

//start the app on port 3000
var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Article Finder app listening at http://%s:%s', host, port);
});