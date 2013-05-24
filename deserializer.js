// Parses RServe output from stream, and converts it to Javascript objects
var _ = require('underscore')
,   util = require("util")
,   EventEmitter = require("events").EventEmitter
,   responses;  // Holds an array of actions on valid responses. Defined at the end

function Parser() {
    EventEmitter.call(this);
    this.on('finish', function(ev) { console.log("Finished: ", ev); });
    this.on('end', function(ev) { console.log("Ended: ", ev); });
    this.on('pipe', function(ev) { console.log("Piped."); });
    this.on('close', function(ev) { console.log("Closed: ", ev); });
    // The following triggers when the parser has processed a new sexpr
}
util.inherits(Parser, EventEmitter);

_.extend(Parser.prototype, {
    parse: function(data) { return(this.cleanResults(this.parseNext(data))); },
    parseNext: function(chunk) {
        // Centralized control for "reading the next block"
        // chunk is the data that this method is responsible for reading
        // 
        // Returns an object corresponding to what it read.
        // The object returned has 4 fields: type, length, an optional "attribute" field 
        // if they have attributes, and a value field containing the return value
        var results = [], nextObj;
        while (chunk.length > 0) {
            nextObj = this.parseOne(chunk);
            results.push(nextObj);            
            chunk = chunk.slice(nextObj.length + 4);
        }
        return results; // Reached end of what we were trying to read
    },
    parseOne: function(chunk) {
        // Reads a single term, then returns. Used to parse attributes
        var obj = this.nextHeader(chunk) // Read information from ahead
        ,   length = obj.length
        ,   objChunk = chunk.slice(4, length + 4) // Skip the header, not needed any more
        ,   fun = obj.fun;
        if (obj.attr) { // It is supposed to have attributes. Let's read them!
            obj.attr = this.parseOne(objChunk);
            objChunk = objChunk.slice(obj.attr.length + 4);
        }
        obj.value = this[obj.fun].call(this, objChunk);
        return obj;
    },
    nextHeader: function(chunk) {
        // Read the next 4 bytes and determines what token is next. Store in this.nextToken
        // and return the value/object
        // It should not absorb anything, itself
        var buf = chunk.slice(0, 4)
        ,   lead = buf[0] // Isolate the next 4 bites.
        ,   lookup = responses[lead & 0x7f]
        ,   obj = _.clone(lookup);
        if (!lookup) {throw 'Unknown token: ' + lead};
        obj.code = lead & 0x7f;  // Killing the most significant bit
        obj.attr = (lead & 0x80) !== 0; // Reading the most significant bit
        obj.header = buf;   // Store the header in the objects, for troubleshooting
        if (lead !== 0x52 & lead !== 0x01 & lead !== 0x02) {
            obj.length = buf.readUInt32LE(0) >> 8; // the remaining 24 numbers are the length
        }
        return obj;
    },
    parseGreeting: function(chunk) { return(chunk.toString('utf8')); },
    parseHeader: function(chunk) { return({}); },
    parseSexp: function(chunk) { return this.parseNext(chunk); },
    parseArrayDouble: function(chunk) {
        var length = chunk.length
        ,   size = length / 8 // Number of doubles to process;
        ,   result = new Array(size);
        for (var i = 0; i < size; i++) result[i] = this.parseDouble(chunk.slice(8*i));
        return result;
    },
    parseArrayString: function(chunk) {
        var length = chunk.length
        ,   start = 0
        ,   end = 0
        ,   result = [];
        while (end <  length) {
            if (chunk[end] == 0x01) break; // We're done
            while (end < length & chunk[end] != 0x00) {end += 1};
            end += 1;
            result.push(this.parseString(chunk.slice(start, end)));
            start = end;
        }
        return result;
    },
    parseArrayBoolean: function(chunk) {
        var i = 0
        ,   size = chunk.readUInt32LE(0)
        ,   result = new Array(size)
        ,   data = chunk.slice(4, 4 + size);
        for (i=0; i < size; i++) {
            result[i] = (data[i] == 0x01) ? true : ((data[i] == 0x02) ? undefined : false);
        }
        return result;
    },
    parseArrayInt: function(chunk) {
        var length = chunk.length
        ,   size = length / 4 // Number of doubles to process;
        ,   result = new Array(size);
        for (var i = 0; i < size; i++) { result[i] = chunk.readUInt32LE(4*i); };
        return result;
    },
    parseUntaggedList: function(chunk) { return this.parseNext(chunk); },
    parseTaggedList: function(chunk) { return this.parseNext(chunk); },
    parseNULL: function(chunk) { return null; },
    parseString: function(chunk) {
        var len = chunk.length, i = 0;
        if (chunk[0] === 0xff) { return undefined; } // Case of NA string;
        while (i < len & chunk[i] != 0x00) { i+=1; };
        if (chunk[i] != 0x00) throw "String did not terminate with 0";
        return chunk.toString('utf8', 0, i);
    },
    parseDouble: function(chunk) { return(chunk.readDoubleLE(0)); },
    cleanResults: function(results) {
        var header = results[0]
        ,   data = results[1];
        if (header.type === 'greeting') {
            return "Greetings! You are talking to RServe through Node!"
        }
        if (!data) return null;
        var cleanObject = function(obj) {
            // Recursively simplifies its object contents
            var data
            ,   attrs;
            if (_.isArray(obj)) { return _.map(obj, cleanObject); }
            if (obj.attr) { attrs = cleanObject(obj.attr); }
            switch(obj.type) {
            case 'sexpr':
                data = cleanObject(obj.value[0]);
                break;
            case 'null':
                data = null;
                break;
            case 'untagged-list':
                data = _.map(obj.value, cleanObject);
                break;
            case 'tagged-list':
                // This is the complicated one!
                var pairs = _.map(obj.value, cleanObject); // pairs of tagged entries
                var newObj = {};
                require('assert').equal(pairs.length % 2, 0, "Should have even number of items for tagged list");
                for (i= pairs.length / 2; i--;) { newObj[pairs[2*i+1]] = pairs[2*i]; }
                data = newObj;
                break;
            case 'symbol-string': // Fall through
            case 'array-int':
            case 'array-double':
            case 'array-string':
            case 'array-boolean':
                data = obj.value;
                break;
            default:
                throw 'Unrecognized component'
            }
            // Add other attributes as a property.
            if (!_.isEmpty(attrs)) { data._attrs = attrs; }
            return data;
        }
        return cleanObject(data);
    }
});

responses = {
    0x0a: {type: 'sexpr', fun: 'parseSexp'}
,   0x00: {type: 'null', fun: 'parseNull'}
,   0x10: {type: 'untagged-list', fun: 'parseUntaggedList'}
,   0x13: {type: 'symbol-string', fun: 'parseString'}
,   0x14: {type: 'untagged-list', fun: 'parseUntaggedList'}
,   0x15: {type: 'tagged-list', fun: 'parseTaggedList'}
,   0x1a: {type: 'untagged-list', fun: 'parseUntaggedList'}
,   0x20: {type: 'array-int', fun: 'parseArrayInt'}
,   0x21: {type: 'array-double', fun: 'parseArrayDouble'}
,   0x22: {type: 'array-string', fun: 'parseArrayString'}
,   0x24: {type: 'array-boolean', fun: 'parseArrayBoolean'}
,   0x52: {type: 'greeting', fun: 'parseGreeting', length: 28}
,   0x01: {type: 'ok_header', fun: 'parseHeader', length: 12}
,   0x02: {type: 'error_header', fun: 'parseHeader', length: 12}
}



// 
// var buf = new require('buffer').Buffer([0x34, 0x45, 0x46, 0x36]);
// new Parser().write(buf);
module.exports = Parser;