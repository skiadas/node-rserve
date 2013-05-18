// Receives request details and converts them to binary steam to be sent to RServe
var util = require('util')
,   Readable = require('stream').Readable;
function Serializer(method, commandStr) {
    Readable.call(this);
    this.method = method;
    this.commandStr = commandStr;
    this.done = false;
}
util.inherits(Serializer, Readable);
Serializer.prototype._read = function(size) {
    if (this.done) { this.push(null); return; };
    this.done = true;
    var strlen = Buffer.byteLength(this.commandStr);
    strlen += 4 - (strlen % 4); // Ensure it's a multiple of 4, possibly not needed
    var buf = new Buffer(16 + 4 + strlen);
    buf.fill(0x00);
    var cmdCode = this.get_command_code(this.method);
    buf.writeUInt32LE(0x03, 0); // Command code
    buf.writeUInt32LE(4 + strlen, 4); // data length
    buf.writeUInt8(0x04, 16);  // Data is a string
    buf.writeUInt32LE(strlen, 17); // Length of the string
    buf.write(this.commandStr, 20, 'utf8');
    this.push(buf);
}

Serializer.prototype.get_command_code = function(method) {
    return;
}
module.exports = Serializer;

// FIXME Structure this module more. It should at least allow multiple 'methods'
