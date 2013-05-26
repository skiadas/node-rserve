// Receives request details and converts them to binary steam to be sent to RServe
var _ = require('underscore');
serialize = function(method, commandStr) {
    if (_.isUndefined(commandStr)) {
        commandStr = method;
        // Use voidEval when no method specified, and string ends in semicolon
        method = (commandStr.match(/;(\n|\r)*$/)) ? 'voidEval' : 'eval';
    }
    var strlen = Buffer.byteLength(commandStr);
    if (strlen % 4) strlen += 4 - (strlen % 4); // Ensure it's a multiple of 4, possibly not needed
    var buf = new Buffer(16 + 4 + strlen);
    buf.fill(0x00);
    var cmdCode = get_command_code(method);
    buf.writeUInt32LE(cmdCode, 0); // Command code
    buf.writeUInt32LE(4 + strlen, 4); // data length
    // FIXME: The following line should actually be righting a 24bit integers in the 17-19 offset
    // Instead it's writing a 16bit integer in the 17-18 offset
    buf.writeUInt16LE(strlen, 17); // Length of the string 
    buf.writeUInt8(0x04, 16);  // Data is a string
    if (strlen > 0) {
        buf.write(commandStr, 20, 'utf8');
    }
    return buf;
}

function get_command_code(method) {
    return {'eval': 0x03, 'voidEval': 0x02, 'login': 0x01}[method];
}
module.exports = serialize;

// FIXME Structure this module more. It should at least allow multiple 'methods'
