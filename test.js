var prismo = require('./index'), express = require('express');

var app = express();

app.get('/:file*', function(req, res){
    prismo(req, req.params.file).pipe(res);
});

app.listen(1337);