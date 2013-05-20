// Node.js client for rserve
//
var _ = require('underscore')
,   net = require('net')
,   util = require('util')
,   EventEmitter = require('events').EventEmitter
,   Parser = require('./deserializer.js')
,   serialize = require('./serializer.js');

function RClient(server) {
    EventEmitter.call(this);
    var server = _.extend({host: 'localhost', port: '6311'}, server);
    console.log("Connecting to: ", server.host + ':' + server.port);
    this.client = new net.Socket();
    var client = this.client
    ,   that = this;
    client.on('data', function(data) {
        var results = (new Parser()).parse(data);
        that.emit('data', results);
        return results;
    });
    client.on('end', function() { console.log('Client received "end" from r-server'); });
    client.on('close', function() { console.log('Connection closed'); });
    client.on('error', function(err) { console.log('Encountered error: ', err); });
    client.connect(server.port, server.host, function() {
        console.log("Connected to:", server.host + ':' + server.port);
        return that;
    });
    this.on('send', this.send); // Send request to prototype;
    this.on('close', this.close);
    return this;
};
util.inherits(RClient, EventEmitter);

// Send computations through "rclient.send(...) or rclient.eval(...)" and friends
// Receive results by listening to the 'data' event.
_.extend(RClient.prototype, {
    send: function(data) {
        console.log("Sending data: ", data);
        if (_.isString(data)) {
            data = {method: 'eval', data: data};
        };
        this.client.write(serialize(data.method, data.data));
    }
    , close: function() {
        this.client.end();
    }
    , repl: function() {
        // Sets client up for interactive mode
        // Client listens on stdin and sends the request to rserve
        // then prints result to stdout
        var that = this;
        that.on('data', function(data) {
            process.stdout.write(util.inspect(data));
            process.stdout.write("\n>> ");
        });
        process.stdin.on('data', function(data) {
            that.send({method: 'eval', data: data });
        });
        process.stdin.setEncoding('utf8');
        process.stdin.resume();

        process.stdin.on('end', function() {
          process.stdout.write('end');
        });
        // process.stdout.write("\n>> ");
    }
});


        // i = i+1;
        // if (i > 2) {
        //     client.destroy();
        // } else {
        //     client.sendSome();
        // }
// client.sendSome = function() {
    // client.write(new Serializer('eval', 'rnorm(5)').read());
    // client.write(new Serializer('eval', 'c("abbott", "costello", NA)').read());
    // client.write(new Serializer('eval', 'sample(c(TRUE, FALSE), 20, TRUE)').read());
    // client.write(new Serializer('eval', 'c(TRUE, NA, FALSE)').read());
    // client.write(new Serializer('eval', "a = 'john'; attr(a, 'a') = 'jack';a").read());
    // client.write(new Serializer('eval', "list(a = 'john', b=1:4, c=rnorm(4))").read());
    // client.write(new Serializer('eval', "t.test(1:5)").read());
    // client.write(new Serializer('eval', 'list(1:5, c("Abbott", "Costello"), NA)').read());
    // client.write(new Serializer('eval', 'c(1, NA, 2)').read());
// };

module.exports = RClient;

if (require.main === module) {
    // Some basic testing code can go here
    new RClient().repl();
    
}
// initialize({server: 'localhost', port: 6311});