var stream = require('stream').Stream;
var range = require('mr.rager');
var util = require('util');
var fs = require('fs');
var os = require('os');
var mime = require('mime-magic');

function Scotty(req, file, opts){
    stream.call(this);
    var self = this;
    self.opts = opts;
    self.path = file;
    self.buffers = [];
    self.src = req;

    self.on('pipe', function(stream){
        self.src = stream;
    });

    var byteRange = function(item, size){
        return 'bytes ' + item[0].begining + '-' + item[0].end + '/' + size;
    };

    var addHeaders = function(orig, next){
        var extKeys = Object.keys(next);
        for (var i = 0; i < extKeys; i++){
            orig[extKeys[i]] = next[extKeys[i]];
        }
    };

    var polish = function polish(err, type){
        return function(err, stat){
            if (err) return err;
                self.stat = stat;
                var proxyS;
                if (self.src && (self.src.method === 'GET' || self.src.method === 'HEAD') && self._dest){
                    if (self.src.headers['range']){
                        var ranges = range(self.src.headers['range'], stat.size);
                        var headers = {
                            'content-type': type,
                            'content-length': ranges[0].end - ranges[0].begining + 1,
                            'content-range': byteRange(ranges, stat.size),
                            'accept-ranges': 'bytes',
                            'connection': 'close',
                        };
                        if (opts && opts.headers) addHeaders(headers, opts.headers);
                        self._dest.writeHead(206, headers);
                        proxyS = fs.createReadStream(self.path, {start: ranges[0].begining, end: ranges[0].end});
                        proxyS.pipe(self._dest);
                        proxyS.pipe(self);
                    }
                    else{
                        var full = {
                            'content-type': type,
                            'content-length': stat.size
                        };
                        if (opts && opts.headers) addHeaders(full, opts.headers);
                        self._dest.writeHead(200, full);
                        proxyS = fs.createReadStream(self.path);
                        proxyS.pipe(self._dest);
                        proxyS.pipe(self);
                    }
                }
            };
        };

    process.nextTick(function(){
        if (os.platform() === "Windows"){
            self.path = self.path.replace(/\//, '\\');
        }
        mime(self.path, function(err, type){
            fs.stat(self.path, polish(err, type));
        });
    });
}

util.inherits(Scotty, stream);

var doStream = function doStream(req){
    if (this.src && this.src.method && this.src.headers['range']){
        return true;
    }
    else{
        return false;
    }
};

Scotty.prototype.doStream = doStream;

Scotty.prototype.write = function(chunk){
    this.emit('data', chunk);
};

Scotty.prototype.end = function(chunk){
    if (chunk) this.write(chunk);
    this.emit('end');
};

Scotty.prototype.pipe = function(dest, opts){
    this._dest = dest;
    this._destOps = opts;
    this._dest.emit('pipe', this);
    return this._dest;
};

Scotty.prototype.beamMeUp = Scotty.prototype.pipe;

module.exports = function(req, file, opts){
    return new Scotty(req, file, opts);
};