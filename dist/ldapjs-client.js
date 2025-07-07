/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 725:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

module.exports = __nccwpck_require__(7768)


/***/ }),

/***/ 455:
/***/ ((module) => {

// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.


module.exports = {

  newInvalidAsn1Error: function (msg) {
    var e = new Error();
    e.name = 'InvalidAsn1Error';
    e.message = msg || '';
    return e;
  }

};


/***/ }),

/***/ 6961:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

var errors = __nccwpck_require__(455);
var types = __nccwpck_require__(1531);

var Reader = __nccwpck_require__(3961);
var Writer = __nccwpck_require__(1042);


// --- Exports

module.exports = {

  Reader: Reader,

  Writer: Writer

};

for (var t in types) {
  if (types.hasOwnProperty(t))
    module.exports[t] = types[t];
}
for (var e in errors) {
  if (errors.hasOwnProperty(e))
    module.exports[e] = errors[e];
}


/***/ }),

/***/ 3961:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

var assert = __nccwpck_require__(9491);
var Buffer = (__nccwpck_require__(7556).Buffer);

var ASN1 = __nccwpck_require__(1531);
var errors = __nccwpck_require__(455);


// --- Globals

var newInvalidAsn1Error = errors.newInvalidAsn1Error;



// --- API

function Reader(data) {
  if (!data || !Buffer.isBuffer(data))
    throw new TypeError('data must be a node Buffer');

  this._buf = data;
  this._size = data.length;

  // These hold the "current" state
  this._len = 0;
  this._offset = 0;
}

Object.defineProperty(Reader.prototype, 'length', {
  enumerable: true,
  get: function () { return (this._len); }
});

Object.defineProperty(Reader.prototype, 'offset', {
  enumerable: true,
  get: function () { return (this._offset); }
});

Object.defineProperty(Reader.prototype, 'remain', {
  get: function () { return (this._size - this._offset); }
});

Object.defineProperty(Reader.prototype, 'buffer', {
  get: function () { return (this._buf.slice(this._offset)); }
});


/**
 * Reads a single byte and advances offset; you can pass in `true` to make this
 * a "peek" operation (i.e., get the byte, but don't advance the offset).
 *
 * @param {Boolean} peek true means don't move offset.
 * @return {Number} the next byte, null if not enough data.
 */
Reader.prototype.readByte = function (peek) {
  if (this._size - this._offset < 1)
    return null;

  var b = this._buf[this._offset] & 0xff;

  if (!peek)
    this._offset += 1;

  return b;
};


Reader.prototype.peek = function () {
  return this.readByte(true);
};


/**
 * Reads a (potentially) variable length off the BER buffer.  This call is
 * not really meant to be called directly, as callers have to manipulate
 * the internal buffer afterwards.
 *
 * As a result of this call, you can call `Reader.length`, until the
 * next thing called that does a readLength.
 *
 * @return {Number} the amount of offset to advance the buffer.
 * @throws {InvalidAsn1Error} on bad ASN.1
 */
Reader.prototype.readLength = function (offset) {
  if (offset === undefined)
    offset = this._offset;

  if (offset >= this._size)
    return null;

  var lenB = this._buf[offset++] & 0xff;
  if (lenB === null)
    return null;

  if ((lenB & 0x80) === 0x80) {
    lenB &= 0x7f;

    if (lenB === 0)
      throw newInvalidAsn1Error('Indefinite length not supported');

    if (lenB > 4)
      throw newInvalidAsn1Error('encoding too long');

    if (this._size - offset < lenB)
      return null;

    this._len = 0;
    for (var i = 0; i < lenB; i++)
      this._len = (this._len << 8) + (this._buf[offset++] & 0xff);

  } else {
    // Wasn't a variable length
    this._len = lenB;
  }

  return offset;
};


/**
 * Parses the next sequence in this BER buffer.
 *
 * To get the length of the sequence, call `Reader.length`.
 *
 * @return {Number} the sequence's tag.
 */
Reader.prototype.readSequence = function (tag) {
  var seq = this.peek();
  if (seq === null)
    return null;
  if (tag !== undefined && tag !== seq)
    throw newInvalidAsn1Error('Expected 0x' + tag.toString(16) +
                              ': got 0x' + seq.toString(16));

  var o = this.readLength(this._offset + 1); // stored in `length`
  if (o === null)
    return null;

  this._offset = o;
  return seq;
};


Reader.prototype.readInt = function () {
  return this._readTag(ASN1.Integer);
};


Reader.prototype.readBoolean = function () {
  return (this._readTag(ASN1.Boolean) === 0 ? false : true);
};


Reader.prototype.readEnumeration = function () {
  return this._readTag(ASN1.Enumeration);
};


Reader.prototype.readString = function (tag, retbuf) {
  if (!tag)
    tag = ASN1.OctetString;

  var b = this.peek();
  if (b === null)
    return null;

  if (b !== tag)
    throw newInvalidAsn1Error('Expected 0x' + tag.toString(16) +
                              ': got 0x' + b.toString(16));

  var o = this.readLength(this._offset + 1); // stored in `length`

  if (o === null)
    return null;

  if (this.length > this._size - o)
    return null;

  this._offset = o;

  if (this.length === 0)
    return retbuf ? Buffer.alloc(0) : '';

  var str = this._buf.slice(this._offset, this._offset + this.length);
  this._offset += this.length;

  return retbuf ? str : str.toString('utf8');
};

Reader.prototype.readOID = function (tag) {
  if (!tag)
    tag = ASN1.OID;

  var b = this.readString(tag, true);
  if (b === null)
    return null;

  var values = [];
  var value = 0;

  for (var i = 0; i < b.length; i++) {
    var byte = b[i] & 0xff;

    value <<= 7;
    value += byte & 0x7f;
    if ((byte & 0x80) === 0) {
      values.push(value);
      value = 0;
    }
  }

  value = values.shift();
  values.unshift(value % 40);
  values.unshift((value / 40) >> 0);

  return values.join('.');
};


Reader.prototype._readTag = function (tag) {
  assert.ok(tag !== undefined);

  var b = this.peek();

  if (b === null)
    return null;

  if (b !== tag)
    throw newInvalidAsn1Error('Expected 0x' + tag.toString(16) +
                              ': got 0x' + b.toString(16));

  var o = this.readLength(this._offset + 1); // stored in `length`
  if (o === null)
    return null;

  if (this.length > 4)
    throw newInvalidAsn1Error('Integer too long: ' + this.length);

  if (this.length > this._size - o)
    return null;
  this._offset = o;

  var fb = this._buf[this._offset];
  var value = 0;

  for (var i = 0; i < this.length; i++) {
    value <<= 8;
    value |= (this._buf[this._offset++] & 0xff);
  }

  if ((fb & 0x80) === 0x80 && i !== 4)
    value -= (1 << (i * 8));

  return value >> 0;
};



// --- Exported API

module.exports = Reader;


/***/ }),

/***/ 1531:
/***/ ((module) => {

// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.


module.exports = {
  EOC: 0,
  Boolean: 1,
  Integer: 2,
  BitString: 3,
  OctetString: 4,
  Null: 5,
  OID: 6,
  ObjectDescriptor: 7,
  External: 8,
  Real: 9, // float
  Enumeration: 10,
  PDV: 11,
  Utf8String: 12,
  RelativeOID: 13,
  Sequence: 16,
  Set: 17,
  NumericString: 18,
  PrintableString: 19,
  T61String: 20,
  VideotexString: 21,
  IA5String: 22,
  UTCTime: 23,
  GeneralizedTime: 24,
  GraphicString: 25,
  VisibleString: 26,
  GeneralString: 28,
  UniversalString: 29,
  CharacterString: 30,
  BMPString: 31,
  Constructor: 32,
  Context: 128
};


/***/ }),

/***/ 1042:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

var assert = __nccwpck_require__(9491);
var Buffer = (__nccwpck_require__(7556).Buffer);
var ASN1 = __nccwpck_require__(1531);
var errors = __nccwpck_require__(455);


// --- Globals

var newInvalidAsn1Error = errors.newInvalidAsn1Error;

var DEFAULT_OPTS = {
  size: 1024,
  growthFactor: 8
};


// --- Helpers

function merge(from, to) {
  assert.ok(from);
  assert.equal(typeof (from), 'object');
  assert.ok(to);
  assert.equal(typeof (to), 'object');

  var keys = Object.getOwnPropertyNames(from);
  keys.forEach(function (key) {
    if (to[key])
      return;

    var value = Object.getOwnPropertyDescriptor(from, key);
    Object.defineProperty(to, key, value);
  });

  return to;
}



// --- API

function Writer(options) {
  options = merge(DEFAULT_OPTS, options || {});

  this._buf = Buffer.alloc(options.size || 1024);
  this._size = this._buf.length;
  this._offset = 0;
  this._options = options;

  // A list of offsets in the buffer where we need to insert
  // sequence tag/len pairs.
  this._seq = [];
}

Object.defineProperty(Writer.prototype, 'buffer', {
  get: function () {
    if (this._seq.length)
      throw newInvalidAsn1Error(this._seq.length + ' unended sequence(s)');

    return (this._buf.slice(0, this._offset));
  }
});

Writer.prototype.writeByte = function (b) {
  if (typeof (b) !== 'number')
    throw new TypeError('argument must be a Number');

  this._ensure(1);
  this._buf[this._offset++] = b;
};


Writer.prototype.writeInt = function (i, tag) {
  if (typeof (i) !== 'number')
    throw new TypeError('argument must be a Number');
  if (typeof (tag) !== 'number')
    tag = ASN1.Integer;

  var sz = 4;

  while ((((i & 0xff800000) === 0) || ((i & 0xff800000) === 0xff800000 >> 0)) &&
        (sz > 1)) {
    sz--;
    i <<= 8;
  }

  if (sz > 4)
    throw newInvalidAsn1Error('BER ints cannot be > 0xffffffff');

  this._ensure(2 + sz);
  this._buf[this._offset++] = tag;
  this._buf[this._offset++] = sz;

  while (sz-- > 0) {
    this._buf[this._offset++] = ((i & 0xff000000) >>> 24);
    i <<= 8;
  }

};


Writer.prototype.writeNull = function () {
  this.writeByte(ASN1.Null);
  this.writeByte(0x00);
};


Writer.prototype.writeEnumeration = function (i, tag) {
  if (typeof (i) !== 'number')
    throw new TypeError('argument must be a Number');
  if (typeof (tag) !== 'number')
    tag = ASN1.Enumeration;

  return this.writeInt(i, tag);
};


Writer.prototype.writeBoolean = function (b, tag) {
  if (typeof (b) !== 'boolean')
    throw new TypeError('argument must be a Boolean');
  if (typeof (tag) !== 'number')
    tag = ASN1.Boolean;

  this._ensure(3);
  this._buf[this._offset++] = tag;
  this._buf[this._offset++] = 0x01;
  this._buf[this._offset++] = b ? 0xff : 0x00;
};


Writer.prototype.writeString = function (s, tag) {
  if (typeof (s) !== 'string')
    throw new TypeError('argument must be a string (was: ' + typeof (s) + ')');
  if (typeof (tag) !== 'number')
    tag = ASN1.OctetString;

  var len = Buffer.byteLength(s);
  this.writeByte(tag);
  this.writeLength(len);
  if (len) {
    this._ensure(len);
    this._buf.write(s, this._offset);
    this._offset += len;
  }
};


Writer.prototype.writeBuffer = function (buf, tag) {
  if (typeof (tag) !== 'number')
    throw new TypeError('tag must be a number');
  if (!Buffer.isBuffer(buf))
    throw new TypeError('argument must be a buffer');

  this.writeByte(tag);
  this.writeLength(buf.length);
  this._ensure(buf.length);
  buf.copy(this._buf, this._offset, 0, buf.length);
  this._offset += buf.length;
};


Writer.prototype.writeStringArray = function (strings) {
  if ((!strings instanceof Array))
    throw new TypeError('argument must be an Array[String]');

  var self = this;
  strings.forEach(function (s) {
    self.writeString(s);
  });
};

// This is really to solve DER cases, but whatever for now
Writer.prototype.writeOID = function (s, tag) {
  if (typeof (s) !== 'string')
    throw new TypeError('argument must be a string');
  if (typeof (tag) !== 'number')
    tag = ASN1.OID;

  if (!/^([0-9]+\.){3,}[0-9]+$/.test(s))
    throw new Error('argument is not a valid OID string');

  function encodeOctet(bytes, octet) {
    if (octet < 128) {
        bytes.push(octet);
    } else if (octet < 16384) {
        bytes.push((octet >>> 7) | 0x80);
        bytes.push(octet & 0x7F);
    } else if (octet < 2097152) {
      bytes.push((octet >>> 14) | 0x80);
      bytes.push(((octet >>> 7) | 0x80) & 0xFF);
      bytes.push(octet & 0x7F);
    } else if (octet < 268435456) {
      bytes.push((octet >>> 21) | 0x80);
      bytes.push(((octet >>> 14) | 0x80) & 0xFF);
      bytes.push(((octet >>> 7) | 0x80) & 0xFF);
      bytes.push(octet & 0x7F);
    } else {
      bytes.push(((octet >>> 28) | 0x80) & 0xFF);
      bytes.push(((octet >>> 21) | 0x80) & 0xFF);
      bytes.push(((octet >>> 14) | 0x80) & 0xFF);
      bytes.push(((octet >>> 7) | 0x80) & 0xFF);
      bytes.push(octet & 0x7F);
    }
  }

  var tmp = s.split('.');
  var bytes = [];
  bytes.push(parseInt(tmp[0], 10) * 40 + parseInt(tmp[1], 10));
  tmp.slice(2).forEach(function (b) {
    encodeOctet(bytes, parseInt(b, 10));
  });

  var self = this;
  this._ensure(2 + bytes.length);
  this.writeByte(tag);
  this.writeLength(bytes.length);
  bytes.forEach(function (b) {
    self.writeByte(b);
  });
};


Writer.prototype.writeLength = function (len) {
  if (typeof (len) !== 'number')
    throw new TypeError('argument must be a Number');

  this._ensure(4);

  if (len <= 0x7f) {
    this._buf[this._offset++] = len;
  } else if (len <= 0xff) {
    this._buf[this._offset++] = 0x81;
    this._buf[this._offset++] = len;
  } else if (len <= 0xffff) {
    this._buf[this._offset++] = 0x82;
    this._buf[this._offset++] = len >> 8;
    this._buf[this._offset++] = len;
  } else if (len <= 0xffffff) {
    this._buf[this._offset++] = 0x83;
    this._buf[this._offset++] = len >> 16;
    this._buf[this._offset++] = len >> 8;
    this._buf[this._offset++] = len;
  } else {
    throw newInvalidAsn1Error('Length too long (> 4 bytes)');
  }
};

Writer.prototype.startSequence = function (tag) {
  if (typeof (tag) !== 'number')
    tag = ASN1.Sequence | ASN1.Constructor;

  this.writeByte(tag);
  this._seq.push(this._offset);
  this._ensure(3);
  this._offset += 3;
};


Writer.prototype.endSequence = function () {
  var seq = this._seq.pop();
  var start = seq + 3;
  var len = this._offset - start;

  if (len <= 0x7f) {
    this._shift(start, len, -2);
    this._buf[seq] = len;
  } else if (len <= 0xff) {
    this._shift(start, len, -1);
    this._buf[seq] = 0x81;
    this._buf[seq + 1] = len;
  } else if (len <= 0xffff) {
    this._buf[seq] = 0x82;
    this._buf[seq + 1] = len >> 8;
    this._buf[seq + 2] = len;
  } else if (len <= 0xffffff) {
    this._shift(start, len, 1);
    this._buf[seq] = 0x83;
    this._buf[seq + 1] = len >> 16;
    this._buf[seq + 2] = len >> 8;
    this._buf[seq + 3] = len;
  } else {
    throw newInvalidAsn1Error('Sequence too long');
  }
};


Writer.prototype._shift = function (start, len, shift) {
  assert.ok(start !== undefined);
  assert.ok(len !== undefined);
  assert.ok(shift);

  this._buf.copy(this._buf, start + shift, start, start + len);
  this._offset += shift;
};

Writer.prototype._ensure = function (len) {
  assert.ok(len);

  if (this._size - this._offset < len) {
    var sz = this._size * this._options.growthFactor;
    if (sz - this._offset < len)
      sz += len;

    var buf = Buffer.alloc(sz);

    this._buf.copy(buf, 0, 0, this._offset);
    this._buf = buf;
    this._size = sz;
  }
};



// --- Exported API

module.exports = Writer;


/***/ }),

/***/ 2:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

// If you have no idea what ASN.1 or BER is, see this:
// ftp://ftp.rsa.com/pub/pkcs/ascii/layman.asc

var Ber = __nccwpck_require__(6961);



// --- Exported API

module.exports = {

  Ber: Ber,

  BerReader: Ber.Reader,

  BerWriter: Ber.Writer

};


/***/ }),

/***/ 1706:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright (c) 2012, Mark Cavage. All rights reserved.
// Copyright 2015 Joyent, Inc.

var assert = __nccwpck_require__(9491);
var Stream = (__nccwpck_require__(2781).Stream);
var util = __nccwpck_require__(3837);


///--- Globals

/* JSSTYLED */
var UUID_REGEXP = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;


///--- Internal

function _capitalize(str) {
    return (str.charAt(0).toUpperCase() + str.slice(1));
}

function _toss(name, expected, oper, arg, actual) {
    throw new assert.AssertionError({
        message: util.format('%s (%s) is required', name, expected),
        actual: (actual === undefined) ? typeof (arg) : actual(arg),
        expected: expected,
        operator: oper || '===',
        stackStartFunction: _toss.caller
    });
}

function _getClass(arg) {
    return (Object.prototype.toString.call(arg).slice(8, -1));
}

function noop() {
    // Why even bother with asserts?
}


///--- Exports

var types = {
    bool: {
        check: function (arg) { return typeof (arg) === 'boolean'; }
    },
    func: {
        check: function (arg) { return typeof (arg) === 'function'; }
    },
    string: {
        check: function (arg) { return typeof (arg) === 'string'; }
    },
    object: {
        check: function (arg) {
            return typeof (arg) === 'object' && arg !== null;
        }
    },
    number: {
        check: function (arg) {
            return typeof (arg) === 'number' && !isNaN(arg);
        }
    },
    finite: {
        check: function (arg) {
            return typeof (arg) === 'number' && !isNaN(arg) && isFinite(arg);
        }
    },
    buffer: {
        check: function (arg) { return Buffer.isBuffer(arg); },
        operator: 'Buffer.isBuffer'
    },
    array: {
        check: function (arg) { return Array.isArray(arg); },
        operator: 'Array.isArray'
    },
    stream: {
        check: function (arg) { return arg instanceof Stream; },
        operator: 'instanceof',
        actual: _getClass
    },
    date: {
        check: function (arg) { return arg instanceof Date; },
        operator: 'instanceof',
        actual: _getClass
    },
    regexp: {
        check: function (arg) { return arg instanceof RegExp; },
        operator: 'instanceof',
        actual: _getClass
    },
    uuid: {
        check: function (arg) {
            return typeof (arg) === 'string' && UUID_REGEXP.test(arg);
        },
        operator: 'isUUID'
    }
};

function _setExports(ndebug) {
    var keys = Object.keys(types);
    var out;

    /* re-export standard assert */
    if (process.env.NODE_NDEBUG) {
        out = noop;
    } else {
        out = function (arg, msg) {
            if (!arg) {
                _toss(msg, 'true', arg);
            }
        };
    }

    /* standard checks */
    keys.forEach(function (k) {
        if (ndebug) {
            out[k] = noop;
            return;
        }
        var type = types[k];
        out[k] = function (arg, msg) {
            if (!type.check(arg)) {
                _toss(msg, k, type.operator, arg, type.actual);
            }
        };
    });

    /* optional checks */
    keys.forEach(function (k) {
        var name = 'optional' + _capitalize(k);
        if (ndebug) {
            out[name] = noop;
            return;
        }
        var type = types[k];
        out[name] = function (arg, msg) {
            if (arg === undefined || arg === null) {
                return;
            }
            if (!type.check(arg)) {
                _toss(msg, k, type.operator, arg, type.actual);
            }
        };
    });

    /* arrayOf checks */
    keys.forEach(function (k) {
        var name = 'arrayOf' + _capitalize(k);
        if (ndebug) {
            out[name] = noop;
            return;
        }
        var type = types[k];
        var expected = '[' + k + ']';
        out[name] = function (arg, msg) {
            if (!Array.isArray(arg)) {
                _toss(msg, expected, type.operator, arg, type.actual);
            }
            var i;
            for (i = 0; i < arg.length; i++) {
                if (!type.check(arg[i])) {
                    _toss(msg, expected, type.operator, arg, type.actual);
                }
            }
        };
    });

    /* optionalArrayOf checks */
    keys.forEach(function (k) {
        var name = 'optionalArrayOf' + _capitalize(k);
        if (ndebug) {
            out[name] = noop;
            return;
        }
        var type = types[k];
        var expected = '[' + k + ']';
        out[name] = function (arg, msg) {
            if (arg === undefined || arg === null) {
                return;
            }
            if (!Array.isArray(arg)) {
                _toss(msg, expected, type.operator, arg, type.actual);
            }
            var i;
            for (i = 0; i < arg.length; i++) {
                if (!type.check(arg[i])) {
                    _toss(msg, expected, type.operator, arg, type.actual);
                }
            }
        };
    });

    /* re-export built-in assertions */
    Object.keys(assert).forEach(function (k) {
        if (k === 'AssertionError') {
            out[k] = assert[k];
            return;
        }
        if (ndebug) {
            out[k] = noop;
            return;
        }
        out[k] = assert[k];
    });

    /* export ourselves (for unit tests _only_) */
    out._setExports = _setExports;

    return out;
}

module.exports = _setExports(process.env.NODE_NDEBUG);


/***/ }),

/***/ 7191:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney
// Copyright 2016 Joyent, Inc.

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);

///--- Internal

function toJSON(filter) {
  return filter.json;
}

///--- API

function AndFilter(options) {
  assert.optionalObject(options);
  options = options || {};
  assert.optionalArrayOfObject(options.filters, 'options.filters');

  this.filters = options.filters ? options.filters.slice() : [];
}
util.inherits(AndFilter, helpers.Filter);
Object.defineProperties(AndFilter.prototype, {
  type: {
    get: function getType() { return 'and'; },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'And',
        filters: this.filters.map(toJSON)
      };
    },
    configurable: false
  }
});

AndFilter.prototype.toString = function toString() {
  var str = '(&';
  this.filters.forEach(function (f) {
    str += f.toString();
  });
  str += ')';

  return str;
};

AndFilter.prototype.matches = function matches(target, strictAttrCase) {
  assert.object(target, 'target');

  if (this.filters.length === 0) {
    /* true per RFC4526 */
    return true;
  }

  for (var i = 0; i < this.filters.length; i++) {
    if (!this.filters[i].matches(target, strictAttrCase))
      return false;
  }

  return true;
};

AndFilter.prototype.addFilter = function addFilter(filter) {
  assert.object(filter, 'filter');

  this.filters.push(filter);
};


///--- Exports

module.exports = AndFilter;


/***/ }),

/***/ 5487:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);


///--- API

function ApproximateFilter(options) {
  assert.optionalObject(options);
  if (options) {
    assert.string(options.attribute, 'options.attribute');
    assert.string(options.value, 'options.value');
    this.attribute = options.attribute;
    this.value = options.value;
  }
}
util.inherits(ApproximateFilter, helpers.Filter);
Object.defineProperties(ApproximateFilter.prototype, {
  type: {
    get: function getType() { return 'approx'; },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'ApproximateMatch',
        attribute: this.attribute,
        value: this.value
      };
    },
    configurable: false
  }
});

ApproximateFilter.prototype.toString = function toString() {
  return ('(' + helpers.escape(this.attribute) +
          '~=' + helpers.escape(this.value) + ')');
};

ApproximateFilter.prototype.matches = function matches() {
  // Consumers must implement this themselves
  throw new Error('approx match implementation missing');
};


///--- Exports

module.exports = ApproximateFilter;


/***/ }),

/***/ 2010:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);


///--- API

function EqualityFilter(options) {
  assert.optionalObject(options);
  if (options) {
    assert.string(options.attribute, 'options.attribute');
    this.attribute = options.attribute;
    // Prefer Buffers over strings to make filter cloning easier
    if (options.raw) {
      this.raw = options.raw;
    } else {
      this.raw = Buffer.from(options.value);
    }
  } else {
    this.raw = Buffer.alloc(0);
  }
}
util.inherits(EqualityFilter, helpers.Filter);
Object.defineProperties(EqualityFilter.prototype, {
  type: {
    get: function getType() { return 'equal'; },
    configurable: false
  },
  value: {
    get: function getValue() {
      return (Buffer.isBuffer(this.raw)) ? this.raw.toString() : this.raw;
    },
    set: function setValue(val) {
      if (typeof (val) === 'string') {
        this.raw = Buffer.from(val);
      } else if (Buffer.isBuffer(val)) {
        this.raw = Buffer.alloc(val.length);
        val.copy(this.raw);
      } else {
        this.raw = val;
      }
    },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'EqualityMatch',
        attribute: this.attribute,
        value: this.value
      };
    },
    configurable: false
  }
});

EqualityFilter.prototype.toString = function toString() {
  var value, decoded, validate;
  if (Buffer.isBuffer(this.raw)) {
    value = this.raw;
    decoded = this.raw.toString('utf8');
    validate = Buffer.from(decoded, 'utf8');
    /*
     * Use the decoded UTF-8 if it is valid, otherwise fall back to bytes.
     * Since Buffer.compare is missing in older versions of node, a simple
     * length comparison is used as a heuristic.  This can be updated later to
     * a full compare if it is found lacking.
     */
    if (validate.length === this.raw.length) {
      value = decoded;
    }
  } else if (typeof (this.raw) === 'string') {
    value = this.raw;
  } else {
    throw new Error('invalid value type');
  }
  return ('(' + helpers.escape(this.attribute) +
          '=' + helpers.escape(value) + ')');
};

EqualityFilter.prototype.matches = function matches(target, strictAttrCase) {
  assert.object(target, 'target');

  var tv = helpers.getAttrValue(target, this.attribute, strictAttrCase);
  var value = this.value;

  return helpers.testValues(function (v) {
    return value === v;
  }, tv);
};


///--- Exports

module.exports = EqualityFilter;


/***/ }),

/***/ 5:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);


///--- API

function ExtensibleFilter(options) {
  assert.optionalObject(options);
  options = options || {};
  assert.optionalString(options.rule, 'options.rule');
  assert.optionalString(options.matchType, 'options.matchType');
  assert.optionalString(options.attribute, 'options.attribute');
  assert.optionalString(options.value, 'options.value');

  if (options.matchType !== undefined) {
    this.matchType = options.matchType;
  } else {
    this.matchType = options.attribute;
  }
  this.dnAttributes = options.dnAttributes || false;
  this.rule = options.rule;
  this.value = (options.value !== undefined) ? options.value : '';
}
util.inherits(ExtensibleFilter, helpers.Filter);
Object.defineProperties(ExtensibleFilter.prototype, {
  type: {
    get: function getType() { return 'ext'; },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'ExtensibleMatch',
        matchRule: this.rule,
        matchType: this.matchType,
        matchValue: this.value,
        dnAttributes: this.dnAttributes
      };
    },
    configurable: false
  },
  matchingRule: {
    get: function getRule() { return this.rule; },
    configurable: false
  },
  matchValue: {
    get: function getValue() { return this.value; },
    configurable: false
  },
  attribute: {
    get: function getAttribute() { return this.matchType; },
    set: function setAttribute(val) { this.matchType = val; },
    configurable: false
  }
});

ExtensibleFilter.prototype.toString = function toString() {
  var str = '(';

  if (this.matchType)
    str += this.matchType;

  str += ':';

  if (this.dnAttributes)
    str += 'dn:';

  if (this.rule)
    str += this.rule + ':';

  return (str + '=' + this.value + ')');
};

ExtensibleFilter.prototype.matches = function matches() {
  // Consumers must implement this themselves
  throw new Error('ext match implementation missing');
};


///--- Exports

module.exports = ExtensibleFilter;


/***/ }),

/***/ 1769:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);


///--- API

function GreaterThanEqualsFilter(options) {
  assert.optionalObject(options);
  if (options) {
    assert.string(options.attribute, 'options.attribute');
    assert.string(options.value, 'options.value');
    this.attribute = options.attribute;
    this.value = options.value;
  }
}
util.inherits(GreaterThanEqualsFilter, helpers.Filter);
Object.defineProperties(GreaterThanEqualsFilter.prototype, {
  type: {
    get: function getType() { return 'ge'; },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'GreaterThanEqualsMatch',
        attribute: this.attribute,
        value: this.value
      };
    },
    configurable: false
  }
});

GreaterThanEqualsFilter.prototype.toString = function toString() {
  return ('(' + helpers.escape(this.attribute) +
          '>=' + helpers.escape(this.value) + ')');
};

GreaterThanEqualsFilter.prototype.matches = function (target, strictAttrCase) {
  assert.object(target, 'target');

  var tv = helpers.getAttrValue(target, this.attribute, strictAttrCase);
  var value = this.value;

  return helpers.testValues(function (v) {
    return value <= v;
  }, tv);
};


///--- Exports

module.exports = GreaterThanEqualsFilter;


/***/ }),

/***/ 6145:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2014 Patrick Mooney.  All rights reserved.

var assert = __nccwpck_require__(1706);


///--- API

/**
 * RFC 2254 Escaping of filter strings
 *
 * Raw                     Escaped
 * (o=Parens (R Us))       (o=Parens \28R Us\29)
 * (cn=star*)              (cn=star\2A)
 * (filename=C:\MyFile)    (filename=C:\5cMyFile)
 *
 * Use substr_filter to avoid having * ecsaped.
 *
 * @author [Austin King](https://github.com/ozten)
 */
function _escape(inp) {
  var esc = '';
  var i;
  if (typeof (inp) === 'string') {
    for (i = 0; i < inp.length; i++) {
      switch (inp[i]) {
        case '*':
          esc += '\\2a';
          break;
        case '(':
          esc += '\\28';
          break;
        case ')':
          esc += '\\29';
          break;
        case '\\':
          esc += '\\5c';
          break;
        case '\0':
          esc += '\\00';
          break;
        default:
          esc += inp[i];
          break;
      }
    }
    return esc;

  } else {
    assert.buffer(inp, 'input must be string or Buffer');
    for (i = 0; i < inp.length; i++) {
      if (inp[i] < 16) {
        esc += '\\0' + inp[i].toString(16);
      } else {
        esc += '\\' + inp[i].toString(16);
      }
    }
    return esc;
  }
}


/**
 * Check value or array with test function.
 *
 * @param {Function} rule test function.
 * @param value value or array of values.
 * @param {Boolean} allMatch require all array values to match. default: false
 */
function testValues(rule, value, allMatch) {
  if (Array.isArray(value)) {
    var i;
    if (allMatch) {
      // Do all entries match rule?
      for (i = 0; i < value.length; i++) {
        if (!rule(value[i])) {
          return false;
        }
      }
      return true;
    } else {
      // Do any entries match rule?
      for (i = 0; i < value.length; i++) {
        if (rule(value[i])) {
          return true;
        }
      }
      return false;
    }
  } else {
    return rule(value);
  }
}


/**
 * Fetch value for named object attribute.
 *
 * @param {Object} obj object to fetch value from
 * @param {String} attr name of attribute to fetch
 * @param {Boolean} strictCase attribute name is case-sensitive. default: false
 */
function getAttrValue(obj, attr, strictCase) {
  assert.object(obj);
  assert.string(attr);
  // Check for exact case match first
  if (obj.hasOwnProperty(attr)) {
    return obj[attr];
  } else if (strictCase) {
    return undefined;
  }

  // Perform case-insensitive enumeration after that
  var lower = attr.toLowerCase();
  var result;
  Object.getOwnPropertyNames(obj).some(function (name) {
    if (name.toLowerCase() === lower) {
      result = obj[name];
      return true;
    }
    return false;
  });
  return result;
}


/**
 * Filter base class
 */
function Filter() {
}


/**
 * Depth-first filter traversal
 */
Filter.prototype.forEach = function forEach(cb) {
  if (this.filter) {
    // not
    this.filter.forEach(cb);
  } else if (this.filters) {
    // and/or
    this.filters.forEach(function (item) {
      item.forEach(cb);
    });
  }
  cb(this);
};

/**
 * Depth-first map traversal.
 */
Filter.prototype.map = function map(cb) {
  var child;
  if (this.filter) {
    child = this.filter.map(cb);
    if (child === null) {
      // empty NOT not allowed
      return null;
    } else {
      this.filter = child;
    }
  } else if (this.filters) {
    child = this.filters.map(function (item) {
      return item.map(cb);
    }).filter(function (item) {
      return (item !== null);
    });
    if (child.length === 0) {
      // empty and/or not allowed
      return null;
    } else {
      this.filters = child;
    }
  }
  return cb(this);
};


///--- Exports

module.exports = {
  escape: _escape,
  testValues: testValues,
  getAttrValue: getAttrValue,
  Filter: Filter
};


/***/ }),

/***/ 1964:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2014 Patrick Mooney.  All rights reserved.
// Copyright 2016 Joyent, Inc.

var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);

var AndFilter = __nccwpck_require__(7191);
var ApproximateFilter = __nccwpck_require__(5487);
var EqualityFilter = __nccwpck_require__(2010);
var ExtensibleFilter = __nccwpck_require__(5);
var GreaterThanEqualsFilter = __nccwpck_require__(1769);
var LessThanEqualsFilter = __nccwpck_require__(523);
var NotFilter = __nccwpck_require__(9234);
var OrFilter = __nccwpck_require__(8370);
var PresenceFilter = __nccwpck_require__(344);
var SubstringFilter = __nccwpck_require__(2751);


///--- Globals

/* JSSTYLED */
var attrRegex = /^[-_a-zA-Z0-9]+/;
var hexRegex = /^[a-fA-F0-9]{2}$/;


///--- Internal

function escapeValue(str)
{
  var cur = 0;
  var len = str.length;
  var out = '';

  while (cur < len) {
    var c = str[cur];

    switch (c) {
    case '(':
      /*
       * Although '*' characters should be escaped too, we ignore them here in
       * case downstream ExtensibleFilter consumers wish to perform their own
       * value-add parsing after the fact.
       *
       * Handling unescaped ')' is not needed since such occurances will parse
       * as premature (and likely) unbalanced parens in the filter expression.
       */
      throw new Error('illegal unescaped char: ' + c);

    case '\\':
      /* Parse a \XX hex escape value */
      var val = str.substr(cur + 1, 2);
      if (val.match(hexRegex) === null) {
        throw new Error('invalid escaped char');
      }
      out += String.fromCharCode(parseInt(val, 16));
      cur += 3;
      break;

    default:
      /* Add one regular char */
      out += c;
      cur++;
      break;
    }
  }

  return out;
}

function escapeSubstr(str)
{
  var fields = str.split('*');
  var out = {};
  assert.ok(fields.length > 1, 'wildcard missing');

  out.initial = escapeValue(fields.shift());
  out.final = escapeValue(fields.pop());
  out.any = fields.map(escapeValue);
  return out;
}

function parseExt(attr, str)
{
  var fields = str.split(':');
  var res = {
    attribute: attr
  };
  var out;

  /* Having already parsed the attr, the first entry should be empty */
  assert.ok(fields.length > 1, 'invalid ext filter');
  fields.shift();

  if (fields[0].toLowerCase() === 'dn') {
    res.dnAttributes = true;
    fields.shift();
  }
  if (fields.length !== 0 && fields[0][0] !== '=') {
    res.rule = fields.shift();
  }
  if (fields.length === 0 || fields[0][0] !== '=') {
    /* With matchType, dnAttribute, and rule consumed, the := must be next */
    throw new Error('missing := in ext filter');
  }

  /*
   * Trim the leading = (from the :=)  and reinsert any extra ':' charachters
   * which may have been present in the value field.
   */
  str = fields.join(':').substr(1);
  res.value = escapeValue(str);
  out = new ExtensibleFilter(res);

  /*
   * Some extensible filters (such as caseIgnoreSubstringsMatch) operate with
   * values formatted with the substring syntax.  In order to prevent ambiguity
   * between '*' characters which are not escaped and any which are, we attempt
   * substring-style parsing on any value which contains the former.
   */
  if (str.indexOf('*') !== -1) {
    var subres = escapeSubstr(str);
    out.initial = subres.initial;
    out.any = subres.any;
    out.final = subres.final;
  }

  return out;
}

function parseExpr(str)
{
  var attr, match, remain;

  if (str[0] === ':') {
    /*
     * An extensible filter can have no attribute name.
     * (Only valid when using dn and * matching-rule evaluation)
     */
    attr = '';
    remain = str;
  } else if ((match = str.match(attrRegex)) !== null) {
    attr = match[0];
    remain = str.substr(attr.length);
  } else {
    throw new Error('invalid attribute name');
  }

  if (remain === '=*') {
    return new PresenceFilter({
      attribute: attr
    });
  } else if (remain[0] === '=') {
    remain = remain.substr(1);
    if (remain.indexOf('*') !== -1) {
      var val = escapeSubstr(remain);
      return new SubstringFilter({
        attribute: attr,
        initial: val.initial,
        any: val.any,
        final: val.final
      });
    } else {
      return new EqualityFilter({
        attribute: attr,
        value: escapeValue(remain)
      });
    }
  } else if (remain[0] === '>' && remain[1] === '=') {
    return new GreaterThanEqualsFilter({
      attribute: attr,
      value: escapeValue(remain.substr(2))
    });
  } else if (remain[0] === '<' && remain[1] === '=') {
    return new LessThanEqualsFilter({
      attribute: attr,
      value: escapeValue(remain.substr(2))
    });
  } else if (remain[0] === '~' && remain[1] === '=') {
    return new ApproximateFilter({
      attribute: attr,
      value: escapeValue(remain.substr(2))
    });
  } else if (remain[0] === ':') {
    return parseExt(attr, remain);
  }
  throw new Error('invalid expression');
}

function parseFilter(str, start)
{
  var cur = start;
  var len = str.length;
  var res, end, output, children = [];

  if (str[cur++] !== '(') {
      throw new Error('missing paren');
  }

  if (str[cur] === '&') {
    cur++;
    do {
      res = parseFilter(str, cur);
      children.push(res.filter);
      cur = res.end + 1;
    } while (cur < len && str[cur] !== ')');

    output = new AndFilter({filters: children});
  } else if (str[cur] === '|') {
    cur++;
    do {
      res = parseFilter(str, cur);
      children.push(res.filter);
      cur = res.end + 1;
    } while (cur < len && str[cur] !== ')');

    output = new OrFilter({filters: children});
  } else if (str[cur] === '!') {
    res = parseFilter(str, cur + 1);
    output = new NotFilter({filter: res.filter});
    cur = res.end + 1;
    assert.equal(str[cur], ')', 'unbalanced parens');
  } else {
    end = str.indexOf(')', cur);
    assert.notEqual(end, -1, 'unbalanced parens');

    output = parseExpr(str.substr(cur, end - cur));
    cur = end;
  }
  if (cur >= len) {
    throw new Error('unbalanced parens');
  }
  return {
    end: cur,
    filter: output
  };
}


///--- Exports

module.exports = {
  parse: function (str) {
    assert.string(str, 'input must be string');
    assert.ok(str.length > 0, 'input string cannot be empty');

    /* Wrap the input in parens if it was not already */
    if (str.charAt(0) !== '(') {
      str = '(' + str + ')';
    }
    var parsed = parseFilter(str, 0);

    var lastIdx = str.length - 1;
    if (parsed.end < lastIdx) {
      throw new Error('unbalanced parens');
    }

    return parsed.filter;
  },

  // Helper utilties for writing custom matchers
  testValues: helpers.testValues,
  getAttrValue: helpers.getAttrValue,

  // Filter definitions
  AndFilter: AndFilter,
  ApproximateFilter: ApproximateFilter,
  EqualityFilter: EqualityFilter,
  ExtensibleFilter: ExtensibleFilter,
  GreaterThanEqualsFilter: GreaterThanEqualsFilter,
  LessThanEqualsFilter: LessThanEqualsFilter,
  NotFilter: NotFilter,
  OrFilter: OrFilter,
  PresenceFilter: PresenceFilter,
  SubstringFilter: SubstringFilter
};


/***/ }),

/***/ 523:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);


///--- API

function LessThanEqualsFilter(options) {
  assert.optionalObject(options);
  if (options) {
    assert.string(options.attribute, 'options.attribute');
    assert.string(options.value, 'options.attribute');
    this.attribute = options.attribute;
    this.value = options.value;
  }
}
util.inherits(LessThanEqualsFilter, helpers.Filter);
Object.defineProperties(LessThanEqualsFilter.prototype, {
  type: {
    get: function getType() { return 'le'; },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'LessThanEqualsMatch',
        attribute: this.attribute,
        value: this.value
      };
    },
    configurable: false
  }
});

LessThanEqualsFilter.prototype.toString = function toString() {
  return ('(' + helpers.escape(this.attribute) +
          '<=' + helpers.escape(this.value) + ')');
};

LessThanEqualsFilter.prototype.matches = function (target, strictAttrCase) {
  assert.object(target, 'target');

  var tv = helpers.getAttrValue(target, this.attribute, strictAttrCase);
  var value = this.value;

  return helpers.testValues(function (v) {
    return value >= v;
  }, tv);
};


///--- Exports

module.exports = LessThanEqualsFilter;


/***/ }),

/***/ 9234:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney
// Copyright 2016 Joyent, Inc.

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);


///--- API

function NotFilter(options) {
  assert.optionalObject(options);
  options = options || {};
  assert.optionalObject(options.filter, 'options.filter');

  this.filter = options.filter || {};
}
util.inherits(NotFilter, helpers.Filter);
Object.defineProperties(NotFilter.prototype, {
  type: {
    get: function getType() { return 'not'; },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'Not',
        filter: this.filter.json
      };
    },
    configurable: false
  }
});

NotFilter.prototype.setFilter = function setFilter(filter) {
  assert.object(filter, 'filter');
  this.filter = filter;
};

NotFilter.prototype.toString = function toString() {
  return '(!' + this.filter.toString() + ')';
};

NotFilter.prototype.matches = function matches(target, strictAttrCase) {
  return !this.filter.matches(target, strictAttrCase);
};


///--- Exports

module.exports = NotFilter;


/***/ }),

/***/ 8370:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney
// Copyright 2016 Joyent, Inc.

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);

///--- Internal

function toJSON(filter) {
  return filter.json;
}

///--- API

function OrFilter(options) {
  assert.optionalObject(options);
  options = options || {};
  assert.optionalArrayOfObject(options.filters);

  this.filters = options.filters ? options.filters.slice() : [];
}
util.inherits(OrFilter, helpers.Filter);
Object.defineProperties(OrFilter.prototype, {
  type: {
    get: function getType() { return 'or'; },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'Or',
        filters: this.filters.map(toJSON)
      };
    },
    configurable: false
  }
});

OrFilter.prototype.toString = function toString() {
  var str = '(|';
  this.filters.forEach(function (f) {
    str += f.toString();
  });
  str += ')';

  return str;
};

OrFilter.prototype.matches = function matches(target, strictAttrCase) {
  assert.object(target, 'target');

  for (var i = 0; i < this.filters.length; i++) {
    if (this.filters[i].matches(target, strictAttrCase))
      return true;
  }

  return false;
};

OrFilter.prototype.addFilter = function addFilter(filter) {
  assert.object(filter, 'filter');

  this.filters.push(filter);
};


///--- Exports

module.exports = OrFilter;


/***/ }),

/***/ 344:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);


///--- API

function PresenceFilter(options) {
  assert.optionalObject(options);
  options = options || {};
  assert.optionalString(options.attribute);

  this.attribute = options.attribute;
}
util.inherits(PresenceFilter, helpers.Filter);
Object.defineProperties(PresenceFilter.prototype, {
  type: {
    get: function getType() { return 'present'; },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'PresenceMatch',
        attribute: this.attribute
      };
    },
    configurable: false
  }
});

PresenceFilter.prototype.toString = function toString() {
  return '(' + helpers.escape(this.attribute) + '=*)';
};

PresenceFilter.prototype.matches = function matches(target, strictAttrCase) {
  assert.object(target, 'target');

  var value = helpers.getAttrValue(target, this.attribute, strictAttrCase);

  return (value !== undefined && value !== null);
};


///--- Exports

module.exports = PresenceFilter;


/***/ }),

/***/ 2751:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

// Copyright 2014 Mark Cavage, Inc.  All rights reserved.
// Copyright 2015 Patrick Mooney

var util = __nccwpck_require__(3837);
var assert = __nccwpck_require__(1706);

var helpers = __nccwpck_require__(6145);


///--- Helpers

function escapeRegExp(str) {
  /* JSSTYLED */
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}


///--- API

function SubstringFilter(options) {
  assert.optionalObject(options);
  if (options) {
    assert.string(options.attribute, 'options.attribute');

    this.attribute = options.attribute;
    this.initial = options.initial;
    this.any = options.any ? options.any.slice(0) : [];
    this.final = options.final;
  } else {
    this.any = [];
  }
}
util.inherits(SubstringFilter, helpers.Filter);
Object.defineProperties(SubstringFilter.prototype, {
  type: {
    get: function getType() { return 'substring'; },
    configurable: false
  },
  json: {
    get: function getJson() {
      return {
        type: 'SubstringMatch',
        initial: this.initial,
        any: this.any,
        final: this.final
      };
    },
    configurable: false
  }
});

SubstringFilter.prototype.toString = function toString() {
  var str = '(' + helpers.escape(this.attribute) + '=';

  if (this.initial)
    str += helpers.escape(this.initial);

  str += '*';

  this.any.forEach(function (s) {
    str += helpers.escape(s) + '*';
  });

  if (this.final)
    str += helpers.escape(this.final);

  str += ')';

  return str;
};

SubstringFilter.prototype.matches = function matches(target, strictAttrCase) {
  assert.object(target, 'target');

  var tv = helpers.getAttrValue(target, this.attribute, strictAttrCase);

  if (tv !== undefined && tv !== null) {
    var re = '';

    if (this.initial)
      re += '^' + escapeRegExp(this.initial) + '.*';
    this.any.forEach(function (s) {
      re += escapeRegExp(s) + '.*';
    });
    if (this.final)
      re += escapeRegExp(this.final) + '$';

    var matcher = new RegExp(re);
    return helpers.testValues(function (v) {
      return matcher.test(v);
    }, tv);
  }

  return false;
};


///--- Exports

module.exports = SubstringFilter;


/***/ }),

/***/ 2011:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);
const asn1 = __nccwpck_require__(2);
const Protocol = __nccwpck_require__(4116);

const _bufferEncoding = type =>  type.endsWith(';binary') ? 'base64' : 'utf8';

class Attribute {
  constructor(options) {
    options = options || {};

    assert.object(options, 'options');
    assert.optionalString(options.type, 'options.type');

    this.type = options.type || '';
    this._vals = [];

    if (options.vals !== undefined && options.vals !== null)
      this.vals = options.vals;
  }

  get json() {
    return {
      type: this.type,
      vals: this.vals
    };
  }

  get vals() {
    const eType = _bufferEncoding(this.type);
    return this._vals.map(v => v.toString(eType));
  }

  set vals(vals) {
    this._vals = [];
    if (Array.isArray(vals)) {
      vals.forEach(v => this.addValue(v));
    } else {
      this.addValue(vals);
    }
  }

  addValue(val) {
    if (Buffer.isBuffer(val)) {
      this._vals.push(val);
    } else {
      this._vals.push(Buffer.from(String(val), _bufferEncoding(this.type)));
    }
  }

  parse(ber) {
    assert.ok(ber);

    ber.readSequence();
    this.type = ber.readString();

    if (ber.peek() === Protocol.LBER_SET) {
      if (ber.readSequence(Protocol.LBER_SET)) {
        const end = ber.offset + ber.length;
        while (ber.offset < end)
          this._vals.push(ber.readString(asn1.Ber.OctetString, true));
      }
    }

    return true;
  }

  toBer(ber) {
    assert.ok(ber);

    ber.startSequence();
    ber.writeString(this.type);
    ber.startSequence(Protocol.LBER_SET);
    if (this._vals.length) {
      this._vals.forEach(b => {
        ber.writeByte(asn1.Ber.OctetString);
        ber.writeLength(b.length);
        b.forEach(i => ber.writeByte(i));
      });
    } else {
      ber.writeStringArray([]);
    }
    ber.endSequence();
    ber.endSequence();

    return ber;
  }

  toString() {
    return JSON.stringify(this.json);
  }

  static compare(a, b) {
    assert.ok(Attribute.isAttribute(a) && Attribute.isAttribute(b), 'can only compare Attributes');

    if (a.type < b.type) return -1;
    if (a.type > b.type) return 1;
    if (a.vals.length < b.vals.length) return -1;
    if (a.vals.length > b.vals.length) return 1;

    for (let i = 0; i < a.vals.length; ++i) {
      if (a.vals[i] < b.vals[i]) return -1;
      if (a.vals[i] > b.vals[i]) return 1;
    }

    return 0;
  }

  static toBer(attr, ber) {
    return Attribute.prototype.toBer.call(attr, ber);
  }

  static isAttribute(attr) {
    if (!attr || typeof (attr) !== 'object') {
      return false;
    }
    if (attr instanceof Attribute) {
      return true;
    }
    return typeof attr.toBer === 'function' && typeof attr.type === 'string' && Array.isArray(attr.vals)
      && attr.vals.filter(item => typeof item === 'string' || Buffer.isBuffer(item)).length === attr.vals.length;
  }

  static fromObject(attributes) {
    return Object.keys(attributes).map(k => {
      const attr = new Attribute({ type: k });

      if (Array.isArray(attributes[k])) {
        attributes[k].forEach(v => attr.addValue(v.toString()));
      } else {
        attr.addValue(attributes[k].toString());
      }

      return attr;
    });
  }
}

module.exports = Attribute;


/***/ }),

/***/ 2832:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);
const Attribute = __nccwpck_require__(2011);

class Change {
  constructor(options) {
    if (options) {
      assert.object(options);
      assert.optionalString(options.operation);
    } else {
      options = {};
    }

    this._modification = false;
    this.operation = options.operation || options.type || 'add';
    this.modification = options.modification || {};
  }

  get operation() {
    switch (this._operation) {
      case 0x00: return 'add';
      case 0x01: return 'delete';
      case 0x02: return 'replace';
      default:
        throw new Error(`0x${this._operation.toString(16)} is invalid`);
    }
  }

  set operation(val) {
    assert.string(val);
    switch (val.toLowerCase()) {
      case 'add':
        this._operation = 0x00;
        break;
      case 'delete':
        this._operation = 0x01;
        break;
      case 'replace':
        this._operation = 0x02;
        break;
      default:
        throw new Error(`Invalid operation type: 0x${val.toString(16)}`);
    }
  }

  get modification() {
    return this._modification;
  }

  set modification(val) {
    if (Attribute.isAttribute(val)) {
      this._modification = val;
      return;
    }
    if (Object.keys(val).length == 2 && typeof val.type === 'string' && Array.isArray(val.vals)) {
      this._modification = new Attribute({
        type: val.type,
        vals: val.vals
      });
      return;
    }

    const keys = Object.keys(val);
    if (keys.length > 1) {
      throw new Error('Only one attribute per Change allowed');
    } else if (keys.length === 0) {
      return;
    }

    const k = keys[0];
    const _attr = new Attribute({ type: k });
    if (Array.isArray(val[k])) {
      val[k].forEach(v => _attr.addValue(v.toString()));
    } else {
      _attr.addValue(val[k].toString());
    }
    this._modification = _attr;
  }

  get json() {
    return {
      operation: this.operation,
      modification: this._modification ? this._modification.json : {}
    };
  }

  static compare(a, b) {
    assert.ok(Change.isChange(a) && Change.isChange(b), 'can only compare Changes');

    if (a.operation < b.operation)
      return -1;
    if (a.operation > b.operation)
      return 1;

    return Attribute.compare(a.modification, b.modification);
  }

  static isChange(change) {
    if (!change || typeof change !== 'object') {
      return false;
    }
    return change instanceof Change || (typeof change.toBer === 'function' && change.modification !== undefined && change.operation !== undefined);
  }

  static fromObject(change) {
    assert.ok(change.operation || change.type, 'change.operation required');
    assert.object(change.modification, 'change.modification');

    if (Object.keys(change.modification).length == 2 && typeof change.modification.type === 'string' && Array.isArray(change.modification.vals)) {
      return [new Change({
        operation: change.operation || change.type,
        modification: change.modification
      })];
    } else {
      return Object.keys(change.modification).map(k => new Change({
        operation: change.operation || change.type,
        modification: {
          [k]: change.modification[k]
        }
      }));
    }
  }

  parse(ber) {
    assert.ok(ber);

    ber.readSequence();
    this._operation = ber.readEnumeration();
    this._modification = new Attribute();
    this._modification.parse(ber);

    return true;
  }

  toBer(ber) {
    assert.ok(ber);

    ber.startSequence();
    ber.writeEnumeration(this._operation);
    ber = this._modification.toBer(ber);
    ber.endSequence();

    return ber;
  }
}

module.exports = Change;


/***/ }),

/***/ 9996:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);

///--- Helpers

const invalidDN = name => {
  const e = new Error();
  e.name = 'InvalidDistinguishedNameError';
  e.message = name;
  return e;
};

const isAlphaNumeric = c => /[A-Za-z0-9]/.test(c);
const isWhitespace = c => /\s/.test(c);

const escapeValue = (val, forceQuote) => {
  let out = '';
  let cur = 0;
  const len = val.length;
  let quoted = false;
  const escaped = /[\\"]/;
  const special = /[,=+<>#;]/;

  if (len > 0) {
    quoted = forceQuote || (val[0] == ' ' || val[len-1] == ' ');
  }

  while (cur < len) {
    if (escaped.test(val[cur]) || (!quoted && special.test(val[cur]))) {
      out += '\\';
    }
    out += val[cur++];
  }
  if (quoted)
    out = `"${  out  }"`;
  return out;
};

///--- API

class RDN {
  constructor(obj) {
    this.attrs = {};

    if (obj) {
      Object.keys(obj).forEach(k => this.set(k, obj[k]));
    }
  }

  set(name, value) {
    assert.string(name, 'name (string) required');
    assert.string(value, 'value (string) required');

    const lname = name.toLowerCase();
    this.attrs[lname] = { name, value };
  }

  toString() {
    const keys = Object.keys(this.attrs);
    keys.sort((a, b) => a.localeCompare(b) || this.attrs[a].value.localeCompare(this.attrs[b].value));

    return keys
      .map(key => `${key}=${escapeValue(this.attrs[key].value)}`)
      .join('+');
  }
}

// Thank you OpenJDK!
const parse = name => {
  assert.string(name, 'name');

  let cur = 0;
  const len = name.length;

  const parseRdn = () => {
    const rdn = new RDN();
    let order = 0;
    rdn.spLead = trim();
    while (cur < len) {
      const opts = {
        order: order
      };
      const attr = parseAttrType();
      trim();
      if (cur >= len || name[cur++] !== '=')
        throw invalidDN(name);

      trim();
      // Parameters about RDN value are set in 'opts' by parseAttrValue
      const value = parseAttrValue(opts);
      rdn.set(attr, value, opts);
      rdn.spTrail = trim();
      if (cur >= len || name[cur] !== '+')
        break;
      ++cur;
      ++order;
    }
    return rdn;
  };

  const trim = () => {
    let count = 0;
    while ((cur < len) && isWhitespace(name[cur])) {
      ++cur;
      ++count;
    }
    return count;
  };

  const parseAttrType = () => {
    const beg = cur;
    while (cur < len) {
      const c = name[cur];
      if (isAlphaNumeric(c) ||
          c == '.' ||
          c == '-' ||
          c == ' ') {
        ++cur;
      } else {
        break;
      }
    }
    // Back out any trailing spaces.
    while ((cur > beg) && (name[cur - 1] == ' '))
      --cur;

    if (beg == cur)
      throw invalidDN(name);

    return name.slice(beg, cur);
  };

  const parseAttrValue = opts => {
    if (cur < len && name[cur] == '#') {
      opts.binary = true;
      return parseBinaryAttrValue();
    } else if (cur < len && name[cur] == '"') {
      opts.quoted = true;
      return parseQuotedAttrValue();
    } else {
      return parseStringAttrValue();
    }
  };

  const parseBinaryAttrValue = () => {
    const beg = cur++;
    while (cur < len && isAlphaNumeric(name[cur]))
      ++cur;

    return name.slice(beg, cur);
  };

  const parseQuotedAttrValue = () => {
    let str = '';
    ++cur; // Consume the first quote

    while ((cur < len) && name[cur] != '"') {
      if (name[cur] === '\\')
        cur++;
      str += name[cur++];
    }
    if (cur++ >= len) // no closing quote
      throw invalidDN(name);

    return str;
  };

  const parseStringAttrValue = () => {
    const beg = cur;
    let str = '';
    let esc = -1;

    while ((cur < len) && !atTerminator()) {
      if (name[cur] === '\\') {
        // Consume the backslash and mark its place just in case it's escaping
        // whitespace which needs to be preserved.
        esc = cur++;
      }
      if (cur === len) // backslash followed by nothing
        throw invalidDN(name);
      str += name[cur++];
    }

    // Trim off (unescaped) trailing whitespace and rewind cursor to the end of
    // the AttrValue to record whitespace length.
    for (; cur > beg; cur--) {
      if (!isWhitespace(name[cur - 1]) || (esc === (cur - 1)))
        break;
    }
    return str.slice(0, cur - beg);
  };

  const atTerminator = () => cur < len && (name[cur] === ',' || name[cur] === ';' || name[cur] === '+');

  const rdns = [];

  // Short-circuit for empty DNs
  if (len === 0)
    return new DN(rdns);

  rdns.push(parseRdn());
  while (cur < len) {
    if (name[cur] === ',' || name[cur] === ';') {
      ++cur;
      rdns.push(parseRdn());
    } else {
      throw invalidDN(name);
    }
  }

  return new DN(rdns);
};

class DN {
  constructor(rdns) {
    assert.optionalArrayOfObject(rdns, 'rdns');

    this.rdns = rdns ? rdns.slice() : [];
  }

  static isDN(dn) {
    return dn instanceof DN || (dn && Array.isArray(dn.rdns));
  }

  toString() {
    return this.rdns.map(String).join(', ');
  }
}


module.exports = { parse, DN, RDN };


/***/ }),

/***/ 9126:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);
const { Response } = __nccwpck_require__(8754);
const CODES = __nccwpck_require__(5698);

const ERRORS = {};
const capitalize = str => str.charAt(0) + str.slice(1).toLowerCase();

class LDAPError extends Error {
  constructor(message, dn, caller) {
    super(message);

    if (Error.captureStackTrace)
      Error.captureStackTrace(this, caller || LDAPError);

    this.lde_message = message;
    this.lde_dn = dn;
  }

  get name() {
    return 'LDAPError';
  }

  get code() {
    return CODES.LDAP_OTHER;
  }

  get message() {
    return this.lde_message || this.name;
  }

  get dn() {
    return this.lde_dn ? this.lde_dn.toString() : '';
  }
}

class ConnectionError extends LDAPError {
  constructor(message) {
    super(message, null, ConnectionError);
  }

  get name() {
    return 'ConnectionError';
  }
}

class TimeoutError extends LDAPError {
  constructor(message) {
    super(message, null, TimeoutError);
  }

  get name() {
    return 'TimeoutError';
  }
}

Object.keys(CODES)
  .filter(key => key !== 'LDAP_SUCCESS')
  .forEach(key => {
    const pieces = key.split('_').slice(1).map(capitalize);
    if (pieces[pieces.length - 1] !== 'Error') {
      pieces.push('Error');
    }

    ERRORS[CODES[key]] = class extends LDAPError {
      get message() {
        return pieces.join(' ');
      }

      get name() {
        return pieces.join('');
      }

      get code() {
        return CODES[key];
      }
    };
  });

module.exports = {
  ConnectionError,
  TimeoutError,
  ProtocolError: ERRORS[CODES.LDAP_PROTOCOL_ERROR],

  LDAP_SUCCESS: CODES.LDAP_SUCCESS,

  getError(res) {
    assert.ok(res instanceof Response, 'res (Response) required');

    return new (ERRORS[res.status])(null, res.matchedDN || null, module.exports.getError);
  }
};


/***/ }),

/***/ 9779:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);
const parents = __nccwpck_require__(1964);
const { BerWriter } = __nccwpck_require__(2);
const { FILTER_AND } = __nccwpck_require__(4116);

module.exports = class AndFilter extends parents.AndFilter {
  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');

    ber.startSequence(FILTER_AND);
    ber = this.filters.reduce((ber, f) => f.toBer(ber), ber);
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 4696:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);
const parents = __nccwpck_require__(1964);
const { BerWriter } = __nccwpck_require__(2);
const { FILTER_APPROX } = __nccwpck_require__(4116);

module.exports = class ApproximateFilter extends parents.ApproximateFilter {
  parse(ber) {
    assert.ok(ber);

    this.attribute = ber.readString().toLowerCase();
    this.value = ber.readString();

    return true;
  }

  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');

    ber.startSequence(FILTER_APPROX);
    ber.writeString(this.attribute);
    ber.writeString(this.value);
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 5034:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);
const parents = __nccwpck_require__(1964);
const { Ber: { OctetString }, BerWriter } = __nccwpck_require__(2);
const { FILTER_EQUALITY } = __nccwpck_require__(4116);

module.exports = class EqualityFilter extends parents.EqualityFilter {
  matches(target, strictAttrCase) {
    assert.object(target, 'target');

    const tv = parents.getAttrValue(target, this.attribute, strictAttrCase);
    const value = this.value;

    if (this.attribute.toLowerCase() === 'objectclass') {
      return parents.testValues(v => value.toLowerCase() === v.toLowerCase(), tv);
    } else {
      return parents.testValues(v => value === v, tv);
    }
  }

  parse(ber) {
    assert.ok(ber);

    this.attribute = ber.readString().toLowerCase();
    this.value = ber.readString(OctetString, true);

    if (this.attribute === 'objectclass') {
      this.value = this.value.toLowerCase();
    }

    return true;
  }

  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');
    if (this.attribute.toLowerCase() === 'objectguid'){
      this.raw = Buffer.from(this.value,'binary');
    }
    ber.startSequence(FILTER_EQUALITY);
    ber.writeString(this.attribute);
    ber.writeBuffer(this.raw, OctetString);
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 2656:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);
const parents = __nccwpck_require__(1964);
const { BerWriter } = __nccwpck_require__(2);
const { FILTER_EXT } = __nccwpck_require__(4116);

module.exports = class ExtensibleFilter extends parents.ExtensibleFilter {
  parse(ber) {
    const end = ber.offset + ber.length;
    while (ber.offset < end) {
      const tag = ber.peek();
      switch (tag) {
        case 0x81:
          this.rule = ber.readString(tag);
          break;
        case 0x82:
          this.matchType = ber.readString(tag);
          break;
        case 0x83:
          this.value = ber.readString(tag);
          break;
        case 0x84:
          this.dnAttributes = ber.readBoolean(tag);
          break;
        default:
          throw new Error(`Invalid ext_match filter type: 0x${tag.toString(16)}`);
      }
    }

    return true;
  }

  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');

    ber.startSequence(FILTER_EXT);

    if (this.rule) {
      ber.writeString(this.rule, 0x81);
    }

    if (this.matchType) {
      ber.writeString(this.matchType, 0x82);
    }

    ber.writeString(this.value, 0x83);

    if (this.dnAttributes) {
      ber.writeBoolean(this.dnAttributes, 0x84);
    }

    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 4362:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(9491);
const parents = __nccwpck_require__(1964);
const { BerWriter } = __nccwpck_require__(2);
const { FILTER_GE } = __nccwpck_require__(4116);

module.exports = class GreaterThanEqualsFilter extends parents.GreaterThanEqualsFilter {
  parse(ber) {
    assert.ok(ber);

    this.attribute = ber.readString().toLowerCase();
    this.value = ber.readString();

    return true;
  }

  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');

    ber.startSequence(FILTER_GE);
    ber.writeString(this.attribute);
    ber.writeString(this.value);
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 7955:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const ldapFilter = __nccwpck_require__(1964);
const AndFilter = __nccwpck_require__(9779);
const ApproximateFilter = __nccwpck_require__(4696);
const EqualityFilter = __nccwpck_require__(5034);
const ExtensibleFilter = __nccwpck_require__(2656);
const GreaterThanEqualsFilter = __nccwpck_require__(4362);
const LessThanEqualsFilter = __nccwpck_require__(5590);
const NotFilter = __nccwpck_require__(1875);
const OrFilter = __nccwpck_require__(2906);
const PresenceFilter = __nccwpck_require__(1915);
const SubstringFilter = __nccwpck_require__(3178);

const cloneFilter = input => {
  switch (input.type) {
    case 'and':
      return new AndFilter({ filters: input.filters.map(cloneFilter) });
    case 'or':
      return new OrFilter({ filters: input.filters.map(cloneFilter) });
    case 'not':
      return new NotFilter({ filter: cloneFilter(input.filter) });
    case 'equal':
      return new EqualityFilter(input);
    case 'substring':
      return new SubstringFilter(input);
    case 'ge':
      return new GreaterThanEqualsFilter(input);
    case 'le':
      return new LessThanEqualsFilter(input);
    case 'present':
      return new PresenceFilter(input);
    case 'approx':
      return new ApproximateFilter(input);
    case 'ext':
      return new ExtensibleFilter(input);
    default:
      throw new Error(`invalid filter type: ${input.type}`);
  }
};

module.exports = {
  parseString: str => cloneFilter(ldapFilter.parse(str))
};


/***/ }),

/***/ 5590:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(9491);
const parents = __nccwpck_require__(1964);
const { BerWriter } = __nccwpck_require__(2);
const { FILTER_LE } = __nccwpck_require__(4116);

module.exports = class LessThanEqualsFilter extends parents.LessThanEqualsFilter {
  parse(ber) {
    assert.ok(ber);

    this.attribute = ber.readString().toLowerCase();
    this.value = ber.readString();

    return true;
  }

  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');

    ber.startSequence(FILTER_LE);
    ber.writeString(this.attribute);
    ber.writeString(this.value);
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 1875:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(9491);
const parents = __nccwpck_require__(1964);
const { BerWriter } = __nccwpck_require__(2);
const { FILTER_NOT } = __nccwpck_require__(4116);

module.exports = class NotFilter extends parents.NotFilter {
  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');

    ber.startSequence(FILTER_NOT);
    ber = this.filter.toBer(ber);
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 2906:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(9491);
const parents = __nccwpck_require__(1964);
const { BerWriter } = __nccwpck_require__(2);
const { FILTER_OR } = __nccwpck_require__(4116);

module.exports = class OrFilter extends parents.OrFilter {
  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');

    ber.startSequence(FILTER_OR);
    ber = this.filters.reduce((ber, f) => f.toBer(ber), ber);
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 1915:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(9491);
const parents = __nccwpck_require__(1964);
const { BerWriter } = __nccwpck_require__(2);
const { FILTER_PRESENT } = __nccwpck_require__(4116);

module.exports = class PresenceFilter extends parents.PresenceFilter {
  parse(ber) {
    assert.ok(ber);

    this.attribute = ber.buffer.slice(0, ber.length).toString('utf8').toLowerCase();
    ber._offset += ber.length;

    return true;
  }

  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');

    ber.startSequence(FILTER_PRESENT);
    Buffer.from(this.attribute).forEach(i => ber.writeByte(i));
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 3178:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(9491);
const parents = __nccwpck_require__(1964);
const { BerWriter } = __nccwpck_require__(2);
const { FILTER_SUBSTRINGS } = __nccwpck_require__(4116);

module.exports = class SubstringFilter extends parents.SubstringFilter {
  parse(ber) {
    assert.ok(ber);

    this.attribute = ber.readString().toLowerCase();
    ber.readSequence();
    const end = ber.offset + ber.length;

    while (ber.offset < end) {
      const tag = ber.peek();
      switch (tag) {
        case 0x80: // Initial
          this.initial = this.attribute === 'objectclass' ? ber.readString(tag).toLowerCase() : ber.readString(tag);
          break;
        case 0x81: // Any
          this.any.push(this.attribute === 'objectclass' ? ber.readString(tag).toLowerCase() : ber.readString(tag));
          break;
        case 0x82: // Final
          this.final = this.attribute === 'objectclass' ? ber.readString(tag).toLowerCase() : ber.readString(tag);
          break;
        default:
          throw new Error(`Invalid substrings filter type: 0x${tag.toString(16)}`);
      }
    }

    return true;
  }

  toBer(ber) {
    assert.ok(ber instanceof BerWriter, 'ber (BerWriter) required');

    ber.startSequence(FILTER_SUBSTRINGS);
    ber.writeString(this.attribute);
    ber.startSequence();

    if (this.initial) {
      ber.writeString(this.initial, 0x80);
    }

    if (this.any && this.any.length) {
      this.any.forEach(s => ber.writeString(s, 0x81));
    }

    if (this.final) {
      ber.writeString(this.final, 0x82);
    }

    ber.endSequence();
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 7768:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const net = __nccwpck_require__(1808);
const tls = __nccwpck_require__(4404);
const assert = __nccwpck_require__(1706);
const Attribute = __nccwpck_require__(2011);
const Change = __nccwpck_require__(2832);
const { parse } = __nccwpck_require__(9996);
const { getError, ConnectionError, TimeoutError, ProtocolError, LDAP_SUCCESS } = __nccwpck_require__(9126);
const { Add, Bind, Del, Modify, ModifyDN, Search, Unbind } = __nccwpck_require__(794);
const { Response, SearchEntry, SearchReference, Parser } = __nccwpck_require__(8754);
const parseUrl = __nccwpck_require__(8462);
const OID = __nccwpck_require__(3170);

class Client {
  constructor(options) {
    assert.object(options, 'options');
    assert.optionalNumber(options.timeout, 'timeout');

    const url = options.url ? parseUrl(options.url) : null;
    delete url.search;

    Object.assign(this, options, url);

    this._queue = new Map();

    this._parser = new Parser();
    this._parser.on('error', e => console.error(e));
    this._parser.on('message', msg => {
      if (msg instanceof SearchEntry || msg instanceof SearchReference) {
        this._queue.get(msg.id).result.push(msg.object);
      } else {
        const qItem = this._queue.get(msg.id);
        if (qItem) {
          const { resolve, reject, result, request, controls } = qItem;

          if (msg instanceof Response) {
            if (msg.status !== LDAP_SUCCESS) {
              reject(getError(msg));
            }

            controls.length = 0;
            msg.controls.forEach((control) => controls.push(control));

            resolve(request instanceof Search ? result : msg.object);
          } else if (msg instanceof Error) {
            reject(msg);
          } else {
            reject(new ProtocolError(msg.type));
          }

          this._queue.delete(msg.id);
        }
      }
    });
  }

  async add(entry, attributes, controls = []) {
    assert.string(entry, 'entry');
    assert.object(attributes, 'attributes');

    return this._send(new Add({ entry, attributes: Attribute.fromObject(attributes), controls }));
  }

  async bind(name, credentials, controls = []) {
    assert.string(name, 'name');
    assert.optionalString(credentials, 'credentials');

    return this._send(new Bind({ name, credentials, controls }));
  }

  async del(entry, controls = []) {
    assert.string(entry, 'entry');

    return this._send(new Del({ entry, controls }));
  }

  async modify(entry, change, controls = []) {
    assert.string(entry, 'entry');
    assert.object(change, 'change');

    const changes = [];
    (Array.isArray(change) ? change : [change]).forEach(c => changes.push(...Change.fromObject(c)));

    return this._send(new Modify({ entry, changes, controls }));
  }

  async modifyDN(entry, newName, controls = []) {
    assert.string(entry, 'entry');
    assert.string(newName, 'newName');

    const newRdn = parse(newName);

    if (newRdn.rdns.length !== 1) {
      return this._send(new ModifyDN({ entry, newRdn: parse(newRdn.rdns.shift().toString()), newSuperior: newRdn }));
    } else {
      return this._send(new ModifyDN({ entry, newRdn, controls }));
    }
  }

  async search(baseObject, options, controls = []) {
    assert.string(baseObject, 'baseObject');
    assert.object(options, 'options');
    assert.optionalString(options.scope, 'options.scope');
    assert.optionalString(options.filter, 'options.filter');
    assert.optionalNumber(options.sizeLimit, 'options.sizeLimit');
    assert.optionalNumber(options.pageSize, 'options.pageSize');
    assert.optionalNumber(options.timeLimit, 'options.timeLimit');
    assert.optionalArrayOfString(options.attributes, 'options.attributes');

    if (options.pageSize) {
      let pageSize = options.pageSize;
      if (pageSize > options.sizeLimit) pageSize = options.sizeLimit;

      const controls0 = controls.filter((control) => {
        return control.OID !== OID.PagedResults;
      });

      const pagedResults = {
        OID: OID.PagedResults,
        criticality: true,
        value: {
          size: pageSize,
          cookie: ''
        }
      };

      let cookie = '';
      let results = [];
      let hasNext = true;
      while (hasNext) {
        pagedResults.value.cookie = cookie;
        controls.length = 0;
        controls = controls.concat(controls0);
        controls.push(pagedResults);

        results = results.concat(await this._send(new Search(Object.assign({ baseObject, controls }, options))));

        const responsePagedResults = controls.find((control) => {
          return control.OID === OID.PagedResults;
        });

        if (responsePagedResults !== undefined && responsePagedResults.value.cookie !== '') {
          cookie = responsePagedResults.value.cookie;
        } else {
          hasNext = false;
        }
      }

      return results;

    } else {
      return this._send(new Search(Object.assign({ baseObject, controls }, options)));
    }
  }

  async unbind(controls = []) {
    return this._send(new Unbind({controls}));
  }

  async destroy() {
    if (this._socket) {
      this._socket.removeAllListeners('error');
      this._socket.removeAllListeners('close');
      this._socket.destroy();
      this._socket = null;
    }

    if (this._parser) {
      this._parser.removeAllListeners('error');
      this._parser.removeAllListeners('message');
      this._parser = null;
    }

    if (this._queue) {
      this._queue.clear();
      this._queue = null;
    }
  }

  async _connect() {
    return new Promise((resolve, reject) => {
      const destroy = () => {
        if (this._socket) {
          this._socket.destroy();
          this._socket = null;
        }

        if (this._queue) {
          for (const { reject } of this._queue.values()) {
            reject(new ConnectionError('Connection closed'));
          }

          this._queue.clear();
        }
      };

      if (this.secure) {
        this._socket = tls.connect(this.port, this.host, this.tlsOptions);
        this._socket.once('secureConnect', resolve);
      } else {
        this._socket = net.connect(this.port, this.host);
        this._socket.once('connect', resolve);
      }

      this._socket.on('close', destroy);
      this._socket.on('error', e => {
        destroy();
        reject(e || new Error('client error during setup'));
      });
      this._socket.on('data', data => this._parser.parse(data));
    });
  }

  async _send(message) {
    if (!this._socket) {
      await this._connect();
    }

    return new Promise((resolve, reject) => {
      try {
        this._queue.set(message.id, { resolve, reject, request: message, result: [], controls: message.controls });
        this._socket.write(message.toBer());

        if (message instanceof Unbind) {
          this._socket.removeAllListeners('close');
          this._socket.on('close', () => resolve(new Response({})));
        }

        if (this.timeout) {
          setTimeout(() => {
            if (this._queue) {
              this._queue.delete(message.id);
            }
            reject(new TimeoutError('request timeout (client interrupt)'));
          }, this.timeout);
        }
      } catch (e) {
        this._queue.delete(message.id);
        reject(e);
      }
    });
  }
}

module.exports = Client;


/***/ }),

/***/ 1041:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const Request = __nccwpck_require__(9464);
const { LDAP_REQ_ADD } = __nccwpck_require__(4116);
const lassert = __nccwpck_require__(9093);

module.exports = class extends Request {
  constructor(options) {
    lassert.optionalStringDN(options.entry);
    lassert.optionalArrayOfAttribute(options.attributes);

    super(Object.assign({ protocolOp: LDAP_REQ_ADD, type: 'AddRequest', attributes: [] }, options));
  }

  _toBer(ber) {
    ber.writeString(this.entry);
    ber.startSequence();
    this.attributes.forEach(a => a.toBer(ber));
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 8351:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { Ber: { Context } } = __nccwpck_require__(2);
const Request = __nccwpck_require__(9464);
const { LDAP_REQ_BIND, LDAP_VERSION_3 } = __nccwpck_require__(4116);

module.exports = class extends Request {
  constructor(options) {
    super(Object.assign({ protocolOp: LDAP_REQ_BIND, credentials: '', type: 'BindRequest' }, options));
  }

  _toBer(ber) {
    ber.writeInt(LDAP_VERSION_3);
    ber.writeString(this.name);
    ber.writeString(this.credentials, Context);

    return ber;
  }
};


/***/ }),

/***/ 7180:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const Request = __nccwpck_require__(9464);
const { LDAP_REQ_DELETE } = __nccwpck_require__(4116);
const lassert = __nccwpck_require__(9093);

module.exports = class extends Request {
  constructor(options) {
    lassert.optionalStringDN(options.entry);

    super(Object.assign({ protocolOp: LDAP_REQ_DELETE, type: 'DeleteRequest' }, options));
  }

  _toBer(ber) {
    Buffer.from(this.entry).forEach(i => ber.writeByte(i));

    return ber;
  }
};


/***/ }),

/***/ 794:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

module.exports = {
  Add: __nccwpck_require__(1041),
  Bind: __nccwpck_require__(8351),
  Del: __nccwpck_require__(7180),
  Modify: __nccwpck_require__(6399),
  ModifyDN: __nccwpck_require__(220),
  Search: __nccwpck_require__(4359),
  Unbind: __nccwpck_require__(5606)
};


/***/ }),

/***/ 220:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const Request = __nccwpck_require__(9464);
const { LDAP_REQ_MODRDN } = __nccwpck_require__(4116);
const lassert = __nccwpck_require__(9093);

module.exports = class extends Request {
  constructor(options) {
    lassert.optionalStringDN(options.entry);
    lassert.optionalDN(options.newRdn);
    lassert.optionalDN(options.newSuperior);

    super(Object.assign({ protocolOp: LDAP_REQ_MODRDN, deleteOldRdn: true, type: 'ModifyDNRequest' }, options));
  }

  _toBer(ber) {
    ber.writeString(this.entry);
    ber.writeString(this.newRdn.toString());
    ber.writeBoolean(this.deleteOldRdn);
    if (this.newSuperior) {
      const s = this.newSuperior.toString();
      const len = Buffer.byteLength(s);

      ber.writeByte(0x80); // MODIFY_DN_REQUEST_NEW_SUPERIOR_TAG
      ber.writeByte(len);
      ber._ensure(len);
      ber._buf.write(s, ber._offset);
      ber._offset += len;
    }

    return ber;
  }
};


/***/ }),

/***/ 6399:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const Request = __nccwpck_require__(9464);
const { LDAP_REQ_MODIFY } = __nccwpck_require__(4116);
const lassert = __nccwpck_require__(9093);

module.exports = class extends Request {
  constructor(options) {
    lassert.optionalStringDN(options.entry);
    lassert.optionalArrayOfAttribute(options.attributes);

    super(Object.assign({ protocolOp: LDAP_REQ_MODIFY, type: 'ModifyRequest' }, options));
  }

  _toBer(ber) {
    ber.writeString(this.entry);
    ber.startSequence();
    this.changes.forEach(c => c.toBer(ber));
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 9464:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const asn1 = __nccwpck_require__(2);
const BerWriter = asn1.BerWriter;
const { LDAP_CONTROLS } = __nccwpck_require__(4116);
const OID = __nccwpck_require__(3170);

let id = 0;
const nextID = () => {
  id = Math.max(1, (id + 1) % 2147483647);
  return id;
};

const controlToBer = (control, writer) => {
  writer.startSequence();
  writer.writeString(control.OID);
  writer.writeBoolean(control.criticality);

  const ber = new BerWriter();
  ber.startSequence();
  switch (control.OID) {
    case OID.PagedResults:
      ber.writeInt(control.value.size);
      if (control.value.cookie === '') {
        ber.writeString('');
      } else {
        ber.writeBuffer(control.value.cookie, asn1.Ber.OctetString);
      }
      break;
    // Add New OID controls here
    default:
  }

  ber.endSequence();
  writer.writeBuffer(ber.buffer, 0x04);

  writer.endSequence();
};

module.exports = class {
  constructor(options) {
    Object.assign(this, options, { id: nextID() });
  }

  toBer() {
    let writer = new BerWriter();
    writer.startSequence();
    writer.writeInt(this.id);
    writer.startSequence(this.protocolOp);
    writer = this._toBer(writer);
    writer.endSequence();

    if (this.controls.length > 0) {
      writer.startSequence(LDAP_CONTROLS);
      this.controls.forEach((control) => {
        controlToBer(control, writer);
      });
      writer.endSequence();
    }

    writer.endSequence();
    return writer.buffer;
  }

  _toBer(ber) {
    return ber;
  }
};


/***/ }),

/***/ 4359:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { Ber } = __nccwpck_require__(2);
const Request = __nccwpck_require__(9464);
const { parseString } = __nccwpck_require__(7955);
const { LDAP_REQ_SEARCH, NEVER_DEREF_ALIASES, SCOPE_BASE_OBJECT, SCOPE_ONE_LEVEL, SCOPE_SUBTREE } = __nccwpck_require__(4116);

const SCOPES = {
  base: SCOPE_BASE_OBJECT,
  one: SCOPE_ONE_LEVEL,
  sub: SCOPE_SUBTREE
};

module.exports = class extends Request {
  constructor(options) {
    super(Object.assign({ protocolOp: LDAP_REQ_SEARCH, scope: 'base', sizeLimit: 0, timeLimit: 10, typesOnly: false, attributes: [], type: 'SearchRequest' }, options));
  }

  set scope(val) {
    if (!(val in SCOPES)) {
      throw new Error(`${val} is an invalid search scope`);
    }

    this._scope = SCOPES[val];
  }

  _toBer(ber) {
    ber.writeString(this.baseObject.toString());
    ber.writeEnumeration(this._scope);
    ber.writeEnumeration(NEVER_DEREF_ALIASES);
    ber.writeInt(this.sizeLimit);
    ber.writeInt(this.timeLimit);
    ber.writeBoolean(this.typesOnly);

    ber = parseString(this.filter || '(objectclass=*)').toBer(ber);

    ber.startSequence(Ber.Sequence | Ber.Constructor);
    if (this.attributes && this.attributes.length) {
      this.attributes.forEach(a => ber.writeString(a));
    }
    ber.endSequence();

    return ber;
  }
};


/***/ }),

/***/ 5606:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const Request = __nccwpck_require__(9464);
const { LDAP_REQ_UNBIND } = __nccwpck_require__(4116);

module.exports = class extends Request {
  constructor(options) {
    super(Object.assign({ protocolOp: LDAP_REQ_UNBIND, type: 'UnbindRequest' }, options));
  }
};


/***/ }),

/***/ 8754:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

module.exports = {
  Response: __nccwpck_require__(3957),
  Parser: __nccwpck_require__(8443),
  SearchEntry: __nccwpck_require__(4454),
  SearchReference: __nccwpck_require__(9699)
};


/***/ }),

/***/ 8443:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const EventEmitter = (__nccwpck_require__(2361).EventEmitter);
const assert = __nccwpck_require__(1706);
const { BerReader } = __nccwpck_require__(2);
const { LDAP_REP_SEARCH_ENTRY, LDAP_REP_SEARCH_REF } = __nccwpck_require__(4116);
const SearchEntry = __nccwpck_require__(4454);
const SearchReference = __nccwpck_require__(9699);
const Response = __nccwpck_require__(3957);

const getMessage = ber => {
  const id = ber.readInt() || 0;
  const type = ber.readSequence();
  const Message = type === LDAP_REP_SEARCH_ENTRY
    ? SearchEntry
    : type === LDAP_REP_SEARCH_REF
      ? SearchReference
      : Response;

  return new Message({ id });
};

class Parser extends EventEmitter {
  constructor() {
    super();
    this.buffer = null;
  }

  parse(data) {
    assert.buffer(data, 'data');

    this.buffer = this.buffer ? Buffer.concat([this.buffer, data]) : data;

    const ber = new BerReader(this.buffer);

    try {
      ber.readSequence();
    } catch (e) {
      this.emit('error', e);
      return;
    }

    // If ber.length == 0, then we do not have a complete chunk
    // and can't proceed with parsing.
    // Allowing this function to continue results in an infinite loop
    // and due to the recursive nature of this function quickly 
    // hits the stack call size limit.
    // This only happens with very large responses.
    if (ber.remain < ber.length || ber.length === 0) {
      return;
    }

    let nextMessage = null;
    if (ber.remain > ber.length) {
      nextMessage = this.buffer.slice(ber.offset + ber.length);
      ber._size = ber.offset + ber.length;
      assert.equal(ber.remain, ber.length);
    }

    this.buffer = null;

    try {
      const message = getMessage(ber);
      message.parse(ber);
      this.emit('message', message);
    } catch (e) {
      this.emit('error', e);
    }

    if (nextMessage) {
      this.parse(nextMessage);
    }
  }
}

module.exports = Parser;


/***/ }),

/***/ 3957:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);
const asn1 = __nccwpck_require__(2);
const Ber = asn1.Ber;
const BerReader = asn1.BerReader;
const { LDAP_REP_REFERRAL, LDAP_CONTROLS } = __nccwpck_require__(4116);
const OID = __nccwpck_require__(3170);

const getControl = (ber) => {
  if (ber.readSequence() === null) { return null; }

  const control = {
    OID: '',
    criticality: false,
    value: null
  };

  if (ber.length) {
    const end = ber.offset + ber.length;

    control.OID = ber.readString();
    if (ber.offset < end && ber.peek() === Ber.Boolean) control.criticality = ber.readBoolean();

    if (ber.offset < end) control.value = ber.readString(Ber.OctetString, true);

    const controlBer = new BerReader(control.value);
    switch (control.OID) {
      case OID.PagedResults:
        controlBer.readSequence();
        control.value = {};
        control.value.size = controlBer.readInt();
        control.value.cookie = controlBer.readString(asn1.Ber.OctetString, true);
        if (control.value.cookie.length === 0) {
          control.value.cookie = '';
        }
        break;
      // Add New OID controls here
      default:
    }
  }

  return control;
};

module.exports = class {
  constructor(options) {
    assert.optionalNumber(options.status);
    assert.optionalString(options.matchedDN);
    assert.optionalString(options.errorMessage);
    assert.optionalArrayOfString(options.referrals);
    assert.optionalArrayOfObject(options.controls);

    Object.assign(this, { status: 0, matchedDN: '', errorMessage: '', referrals: [], type: 'Response', controls: [] }, options);
  }

  get object() {
    return this;
  }

  parse(ber) {
    this.status = ber.readEnumeration();
    this.matchedDN = ber.readString();
    this.errorMessage = ber.readString();

    if (ber.peek() === LDAP_REP_REFERRAL) {
      const end = ber.offset + ber.length;
      while (ber.offset < end) {
        this.referrals.push(ber.readString());
      }
    }

    if (ber.peek() === LDAP_CONTROLS) {
      ber.readSequence();
      const end = ber.offset + ber.length;
      while (ber.offset < end) {
        const c = getControl(ber);
        if (c) { this.controls.push(c); }
      }
    }

    return true;
  }
};


/***/ }),

/***/ 4454:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const assert = __nccwpck_require__(1706);
const Response = __nccwpck_require__(3957);
const Attribute = __nccwpck_require__(2011);
const { LDAP_REP_SEARCH_ENTRY } = __nccwpck_require__(4116);

module.exports = class extends Response {
  constructor(options) {
    super(Object.assign({ protocolOp: LDAP_REP_SEARCH_ENTRY, type: 'SearchEntry', attributes: [] }, options));
  }

  get object() {
    return this.attributes.reduce((obj, a) => {
      obj[a.type] = a.vals && a.vals.length ? a.vals.length > 1 ? a.vals.slice() : a.vals[0] : [];
      return obj;
    }, { dn: this.objectName });
  }

  parse(ber) {
    this.objectName = ber.readString();

    assert.ok(ber.readSequence());

    const end = ber.offset + ber.length;
    while (ber.offset < end) {
      const a = new Attribute();
      a.parse(ber);
      this.attributes.push(a);
    }

    return true;
  }
};


/***/ }),

/***/ 9699:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const Response = __nccwpck_require__(3957);
const { LDAP_REP_SEARCH_REF } = __nccwpck_require__(4116);
const { DN } = __nccwpck_require__(9996);
const parseUrl = __nccwpck_require__(8462);

module.exports = class extends Response {
  constructor(options) {
    super(Object.assign({ protocolOp: LDAP_REP_SEARCH_REF, uris: [], type: 'SearchReference' }, options));
  }

  get object() {
    return {
      dn: new DN().toString(),
      uris: this.uris
    };
  }

  parse(ber) {
    const length = ber.length;

    while (ber.offset < length) {
      const _url = ber.readString();
      parseUrl(_url);
      this.uris.push(_url);
    }

    return true;
  }
};


/***/ }),

/***/ 3170:
/***/ ((module) => {

/**
 * @see {@link https://ldap.com/ldap-oid-reference-guide/}
 */
const OID = {
	PagedResults: '1.2.840.113556.1.4.319'
};

module.exports = OID;


/***/ }),

/***/ 9093:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { AssertionError } = __nccwpck_require__(9491);
const { DN: { isDN } } = __nccwpck_require__(9996);
const { isAttribute } = __nccwpck_require__(2011);

const _assert = (arg, expected, name) => {
  throw new AssertionError({
    message: `${name || expected} (${expected}) required`,
    actual: typeof (arg),
    expected,
    operator: '===',
    stackStartFunction: _assert.caller
  });
};

module.exports = {
  optionalArrayOfAttribute(input, name) {
    if (typeof input !== 'undefined' && (!Array.isArray(input) || input.some(v => !isAttribute(v)))) {
      _assert(input, 'array of Attribute', name);
    }
  },

  optionalDN(input, name) {
    if (typeof input !== 'undefined' && !isDN(input)) {
      _assert(input, 'DN', name);
    }
  },

  optionalStringDN(input, name) {
    if (!(typeof input === 'undefined' || isDN(input) || typeof input === 'string')) {
      _assert(input, 'DN or string', name);
    }
  }
};


/***/ }),

/***/ 5698:
/***/ ((module) => {

module.exports = {
  LDAP_SUCCESS: 0,
  LDAP_OPERATIONS_ERROR: 1,
  LDAP_PROTOCOL_ERROR: 2,
  LDAP_TIME_LIMIT_EXCEEDED: 3,
  LDAP_SIZE_LIMIT_EXCEEDED: 4,
  LDAP_COMPARE_FALSE: 5,
  LDAP_COMPARE_TRUE: 6,
  LDAP_AUTH_METHOD_NOT_SUPPORTED: 7,
  LDAP_STRONG_AUTH_REQUIRED: 8,
  LDAP_REFERRAL: 10,
  LDAP_ADMIN_LIMIT_EXCEEDED: 11,
  LDAP_UNAVAILABLE_CRITICAL_EXTENSION: 12,
  LDAP_CONFIDENTIALITY_REQUIRED: 13,
  LDAP_SASL_BIND_IN_PROGRESS: 14,
  LDAP_NO_SUCH_ATTRIBUTE: 16,
  LDAP_UNDEFINED_ATTRIBUTE_TYPE: 17,
  LDAP_INAPPROPRIATE_MATCHING: 18,
  LDAP_CONSTRAINT_VIOLATION: 19,
  LDAP_ATTRIBUTE_OR_VALUE_EXISTS: 20,
  LDAP_INVALID_ATTRIBUTE_SYNTAX: 21,
  LDAP_NO_SUCH_OBJECT: 32,
  LDAP_ALIAS_PROBLEM: 33,
  LDAP_INVALID_DN_SYNTAX: 34,
  LDAP_ALIAS_DEREF_PROBLEM: 36,
  LDAP_INAPPROPRIATE_AUTHENTICATION: 48,
  LDAP_INVALID_CREDENTIALS: 49,
  LDAP_INSUFFICIENT_ACCESS_RIGHTS: 50,
  LDAP_BUSY: 51,
  LDAP_UNAVAILABLE: 52,
  LDAP_UNWILLING_TO_PERFORM: 53,
  LDAP_LOOP_DETECT: 54,
  LDAP_NAMING_VIOLATION: 64,
  LDAP_OBJECTCLASS_VIOLATION: 65,
  LDAP_NOT_ALLOWED_ON_NON_LEAF: 66,
  LDAP_NOT_ALLOWED_ON_RDN: 67,
  LDAP_ENTRY_ALREADY_EXISTS: 68,
  LDAP_OBJECTCLASS_MODS_PROHIBITED: 69,
  LDAP_AFFECTS_MULTIPLE_DSAS: 71,
  LDAP_OTHER: 80,
  LDAP_PROXIED_AUTHORIZATION_DENIED: 123
};


/***/ }),

/***/ 8462:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const querystring = __nccwpck_require__(3477);
const { parse } = __nccwpck_require__(7310);
const assert = __nccwpck_require__(1706);

const PROTOCOLS = ['ldap:', 'ldaps:'];
const SCOPES = ['base', 'one', 'sub'];

module.exports = str => {
  const u = parse(str);

  assert.ok(PROTOCOLS.includes(u.protocol), `Unsupported protocol: ${u.protocol}`);

  u.secure = u.protocol === 'ldaps:';
  u.host = u.hostname || 'localhost';
  u.port = u.port ? parseInt(u.port, 10) : u.secure ? 636 : 389;
  u.pathname = u.pathname ? querystring.unescape(u.pathname.substr(1)) : u.pathname;

  if (u.search) {
    const tmp = u.search.substr(1).split('?');
    if (tmp[0]) {
      u.attributes = tmp[0].split(',').map(a => querystring.unescape(a.trim()));
    }
    if (tmp[1]) {
      assert.ok(SCOPES.includes(tmp[1]), `Unsupported scope: ${tmp[1]}`);
      u.scope = tmp[1];
    }
    if (tmp[2]) {
      u.filter = querystring.unescape(tmp[2]);
    }
    if (tmp[3]) {
      u.extensions = querystring.unescape(tmp[3]);
    }

    u.attributes = u.attributes || [];
    u.scope = u.scope || 'base';
    u.filter = u.filter || '(objectclass=*)';
  }

  return u;
};


/***/ }),

/***/ 4116:
/***/ ((module) => {

module.exports = {
  LDAP_VERSION_3: 0x03,
  LBER_SET: 0x31,
  LDAP_CONTROLS: 0xa0,

  SCOPE_BASE_OBJECT: 0,
  SCOPE_ONE_LEVEL: 1,
  SCOPE_SUBTREE: 2,

  NEVER_DEREF_ALIASES: 0,
  DEREF_IN_SEARCHING: 1,
  DEREF_BASE_OBJECT: 2,
  DEREF_ALWAYS: 3,

  FILTER_AND: 0xa0,
  FILTER_OR: 0xa1,
  FILTER_NOT: 0xa2,
  FILTER_EQUALITY: 0xa3,
  FILTER_SUBSTRINGS: 0xa4,
  FILTER_GE: 0xa5,
  FILTER_LE: 0xa6,
  FILTER_PRESENT: 0x87,
  FILTER_APPROX: 0xa8,
  FILTER_EXT: 0xa9,

  LDAP_REQ_BIND: 0x60,
  LDAP_REQ_UNBIND: 0x42,
  LDAP_REQ_SEARCH: 0x63,
  LDAP_REQ_MODIFY: 0x66,
  LDAP_REQ_ADD: 0x68,
  LDAP_REQ_DELETE: 0x4a,
  LDAP_REQ_MODRDN: 0x6c,
  LDAP_REQ_COMPARE: 0x6e,
  LDAP_REQ_ABANDON: 0x50,
  LDAP_REQ_EXTENSION: 0x77,

  LDAP_REP_BIND: 0x61,
  LDAP_REP_SEARCH_ENTRY: 0x64,
  LDAP_REP_SEARCH_REF: 0x73,
  LDAP_REP_SEARCH: 0x65,
  LDAP_REP_MODIFY: 0x67,
  LDAP_REP_ADD: 0x69,
  LDAP_REP_DELETE: 0x6b,
  LDAP_REP_MODRDN: 0x6d,
  LDAP_REP_COMPARE: 0x6f,
  LDAP_REP_EXTENSION: 0x78
};


/***/ }),

/***/ 7556:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";
/* eslint-disable node/no-deprecated-api */



var buffer = __nccwpck_require__(4300)
var Buffer = buffer.Buffer

var safer = {}

var key

for (key in buffer) {
  if (!buffer.hasOwnProperty(key)) continue
  if (key === 'SlowBuffer' || key === 'Buffer') continue
  safer[key] = buffer[key]
}

var Safer = safer.Buffer = {}
for (key in Buffer) {
  if (!Buffer.hasOwnProperty(key)) continue
  if (key === 'allocUnsafe' || key === 'allocUnsafeSlow') continue
  Safer[key] = Buffer[key]
}

safer.Buffer.prototype = Buffer.prototype

if (!Safer.from || Safer.from === Uint8Array.from) {
  Safer.from = function (value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('The "value" argument must not be of type number. Received type ' + typeof value)
    }
    if (value && typeof value.length === 'undefined') {
      throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type ' + typeof value)
    }
    return Buffer(value, encodingOrOffset, length)
  }
}

if (!Safer.alloc) {
  Safer.alloc = function (size, fill, encoding) {
    if (typeof size !== 'number') {
      throw new TypeError('The "size" argument must be of type number. Received type ' + typeof size)
    }
    if (size < 0 || size >= 2 * (1 << 30)) {
      throw new RangeError('The value "' + size + '" is invalid for option "size"')
    }
    var buf = Buffer(size)
    if (!fill || fill.length === 0) {
      buf.fill(0)
    } else if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
    return buf
  }
}

if (!safer.kStringMaxLength) {
  try {
    safer.kStringMaxLength = process.binding('buffer').kStringMaxLength
  } catch (e) {
    // we can't determine kStringMaxLength in environments where process.binding
    // is unsupported, so let's not set it
  }
}

if (!safer.constants) {
  safer.constants = {
    MAX_LENGTH: safer.kMaxLength
  }
  if (safer.kStringMaxLength) {
    safer.constants.MAX_STRING_LENGTH = safer.kStringMaxLength
  }
}

module.exports = safer


/***/ }),

/***/ 9491:
/***/ ((module) => {

"use strict";
module.exports = require("assert");

/***/ }),

/***/ 4300:
/***/ ((module) => {

"use strict";
module.exports = require("buffer");

/***/ }),

/***/ 2361:
/***/ ((module) => {

"use strict";
module.exports = require("events");

/***/ }),

/***/ 1808:
/***/ ((module) => {

"use strict";
module.exports = require("net");

/***/ }),

/***/ 3477:
/***/ ((module) => {

"use strict";
module.exports = require("querystring");

/***/ }),

/***/ 2781:
/***/ ((module) => {

"use strict";
module.exports = require("stream");

/***/ }),

/***/ 4404:
/***/ ((module) => {

"use strict";
module.exports = require("tls");

/***/ }),

/***/ 7310:
/***/ ((module) => {

"use strict";
module.exports = require("url");

/***/ }),

/***/ 3837:
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module used 'module' so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(725);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;