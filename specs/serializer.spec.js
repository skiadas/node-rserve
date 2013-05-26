var serialize = require('../serializer.js');
function _randomString(length) {
    length = length || Math.round(1000*Math.random());
    var buf = Buffer(length),
        i;
    for (i=0; i < length;i++) buf[i] = Math.round(92*Math.random()) + 32;
    return buf.toString();
}

describe("The Serializer module", function() {
    it('exports a "serialize" function', function() {
        expect(serialize).toEqual(jasmine.any(Function));
    });
    it('expects a "transmission" method, and uses a "text" command as an extra argument or specified as "this"', function() {
        expect(serialize.bind(this, "eval", "command")).not.toThrow();
        expect(serialize.bind("command", "eval")).not.toThrow();
    });
    it('returns a Buffer object', function() {
        var buf = serialize("eval", "1:5");
        expect(buf).toEqual(jasmine.any(Buffer));
    });
    it('method determines the first 4 bytes', function() {
        expect(serialize("eval", "1:5").readUInt32LE(0)).toEqual(0x03);
        expect(serialize("voidEval", "1:5").readUInt32LE(0)).toEqual(0x02);
    });
    it('buffer length must always be a multiple of 4', function() {
        var ntries = 30, i;
        for (i=ntries; i--;) expect(serialize("eval", _randomString()).length % 4).toEqual(0);
    });
    it('message length is encoded in the next 4 bytes', function() {
        var ntries = 50, i;
        for (i=ntries; i--;) {
            var str, strlen, buf;
                str = _randomString();
                strlen = Buffer.byteLength(str, 'utf8');
                buf = serialize("eval", str);
                expect([0, 1, 2, 3]).toContain(buf.length - strlen - 20);
                expect(buf.length-16).toEqual(buf.readUInt32LE(4));
                expect([0, 1, 2, 3]).toContain((buf.readUInt32LE(16) >> 8) - strlen);
        };
    });
});