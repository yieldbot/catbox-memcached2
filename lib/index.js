/*
 * catbox-memcached2
 * Copyright (c) 2015 Fatih Cetinkaya (http://github.com/cmfatih/catbox-memcached2)
 * For the full copyright and license information, please view the LICENSE.txt file.
 */

/* jslint node: true */
'use strict';

var Memcached    = require('memcached'),
    util         = require('util'),
    EventEmitter = require('events').EventEmitter;

// Init the module
module.exports = function(options) {

  var serverOptions    = options || {},
      serverLocations  = '127.0.0.1:11211',
      serverPartition, // cache key prefix
      eEmitter,        // event emitter
      flags,           // flags (e.g. `{flags: {debug: ['events']}}`)
      cacheClient;     // cache client

  var TTL_MAX = 1000*60*60*24*30; // 2592000000 milliseconds = 30 days

  // Initialize event emitter
  var EEmitter = function EEmitter() { EventEmitter.call(this); };
  util.inherits(EEmitter, EventEmitter);
  eEmitter = new EEmitter();
  eEmitter.on('error', function() { }); // prevent unhandled error event

  // Server options
  // REF: https://github.com/3rd-Eden/node-memcached/issues/170
  //      https://github.com/3rd-Eden/node-memcached/issues/145#issuecomment-27781592
  //
  // Issues
  // failOverServers: https://github.com/3rd-Eden/memcached/issues/92
  // reconnect/ping : https://github.com/3rd-Eden/memcached/issues/166

  if(serverOptions.location) {
    serverLocations = (serverOptions.location instanceof Array) ? serverOptions.location.join(',') : ''+serverOptions.location;
  }

  if(typeof serverOptions.partition === 'string' && serverOptions.partition !== 'NONE') {
    serverPartition = serverOptions.partition;
  }

  if(!serverOptions.poolSize)     serverOptions.poolSize   = 10;    // default 10
  if(!serverOptions.minTimeout)   serverOptions.minTimeout = 0;     // default 1000
  //if(!serverOptions.maxTimeout) serverOptions.maxTimeout = 1000;  // default 60000
  if(!serverOptions.retries)      serverOptions.retries    = 0;     // default 5
  if(!serverOptions.reconnect)    serverOptions.reconnect  = 1000;  // default 18000000 - reconnect delay after server is dead
  //if(!serverOptions.timeout)    serverOptions.timeout    = 5000;  // default 5000     - connection timeout
  if(!serverOptions.failures)     serverOptions.failures   = 1;     // default 5        - sets server dead
  if(!serverOptions.retry)        serverOptions.retry      = 1000;  // default 30000
  if(!serverOptions.idle)         serverOptions.idle       = 60000; // default 5000
  if(!serverOptions.debug)        serverOptions.debug      = false; // default false

  // Flags
  flags = (serverOptions.flags && typeof serverOptions.flags === 'object' && serverOptions.flags) || {};
  var bypassCacheOnConnError = !!flags.bypassCacheOnConnError;

  // Creates a connection to the cache server
  var start = function start(callback) {

    if(typeof callback !== 'function') {
      throw new Error('invalid callback function');
    }

    // If there is an instance then
    if(cacheClient) {
      return callback();
    }

    // Create instance
    cacheClient = new Memcached(serverLocations, serverOptions);

    // Set events
    cacheClient.on('issue', function(details) {
      eEmitter.emit('error', util.format('issue on %s', serverLocations, details));
    });
    cacheClient.on('failure', function(details) {
      eEmitter.emit('error', util.format('failure on %s', serverLocations, details));
    });
    cacheClient.on('remove', function(details) {
      eEmitter.emit('error', util.format('removing %s', serverLocations, details));
    });
    cacheClient.on('reconnecting', function(details) {
      eEmitter.emit('info', util.format('reconnecting to %s', serverLocations, details));
    });
    cacheClient.on('reconnected', function(details) {
      eEmitter.emit('info', util.format('reconnected to %s', serverLocations, details));
    });
      cacheClient.on('reconnect', function(details) {
      eEmitter.emit('info', util.format('reconnect to %s', serverLocations, details));
    });
    eEmitter.emit('start', util.format('started for %s', serverLocations));

    return callback();
  };

  // Ends the cache server connection
  var stop = function stop() {
    if(cacheClient) {
      cacheClient.end();  // end connection
      cacheClient = null; // cleanup

      eEmitter.emit('stop', util.format('stopped for %s', serverLocations));
    }
  };

  // Returns whether the cache server is ready or not
  var isReady = function isReady() {
    return (!!cacheClient);
  };

  // Validates segment name
  var validateSegmentName = function validateSegmentName(name) {
    if(!name || name.indexOf('\n') !== -1 || name.indexOf('\0') !== -1 || name.indexOf('\t') !== -1 || name.indexOf(' ') !== -1) {
      return new Error('invalid segment name');
    }
    return null; // catbox wants null
  };

  // Gets a value for the given key
  var get = function get(key, callback) {

    if(typeof callback !== 'function') {
      throw new Error('invalid callback function');
    }
    else if(!isReady()) {
      return callback(new Error('cache server is not ready'));
    }

    // If key is falsy then
    if(!key) {
      return callback(null, null); // return null like catbox
    }

    // Get cache value
    var keyF = generateKey(key);

    if(!keyF) {
      return callback(new Error('invalid key'));
    }

    eEmitter.emit('get', keyF);

    cacheClient.get(keyF, function(err, result) {
      if(err) {
        if(bypassCacheOnConnError && (err.code === 'ECONNREFUSED' || (typeof err.message === 'string' && err.message.indexOf('not available') !== -1))) {
          return callback(null, null); // bypass cache
        }
        return callback(err);
      }

      // No result then no cache
      if(!result) {
        return callback(null, null);
      }

      // Parse cache content
      var envelope = null;
      try {
        envelope = JSON.parse(result);
      }
      catch(e) {
        eEmitter.emit('error', e);
        return callback(e);
      }

      // Check cache content
      if(!envelope || !envelope.item || !envelope.stored) {
        return callback(new Error('invalid cache content'));
      }

      return callback(null, envelope);
    });
  };

  // Sets a value for the given key
  var set = function set(key, value, ttl, callback) {

    if(typeof callback !== 'function') {
      throw new Error('invalid callback function');
    }
    else if(!key) {
      return callback(new Error('invalid key'));
    }
    else if(typeof ttl !== 'number') {
      return callback(new Error('invalid ttl'));
    }
    else if(!isReady()) {
      return callback(new Error('cache server is not ready'));
    }

    // Prepare cache content
    var envelope = {item: value, stored: Date.now(), ttl: ttl},
        envelopeStr;

    try {
      envelopeStr = JSON.stringify(envelope);
    }
    catch(e) {
      eEmitter.emit('error', e);
      return callback(e);
    }

    // Set cache
    var keyF = generateKey(key);

    if(!keyF) {
      return callback(new Error('invalid key'));
    }

    eEmitter.emit('set', keyF);

    // Expiry
    var expiry = Math.max(1, Math.floor(envelope.ttl / 1000)); // min is 1 sec
    // If ttl is greater than max ttl
    if(envelope.ttl > TTL_MAX) {
      // REF: https://github.com/memcached/memcached/blob/master/doc/protocol.txt#L79
      // Calculate timestamp
      expiry = Math.max(1, Math.floor((new Date(envelope.stored + envelope.ttl).getTime()) / 1000)); // min is 1 sec
    }

    cacheClient.set(keyF, envelopeStr, expiry, function(err) {
      if(err) {
        if(bypassCacheOnConnError && (err.code === 'ECONNREFUSED' || (typeof err.message === 'string' && err.message.indexOf('not available') !== -1))) {
          return callback(); // bypass cache
        }
        return callback(err);
      }

      return callback();
    });
  };

  // Remove the given key
  var drop = function drop(key, callback) {

    if(typeof callback !== 'function') {
      throw new Error('invalid callback function');
    }
    else if(!isReady()) {
      return callback(new Error('cache server is not ready'));
    }

    // Drop cache
    var keyF = generateKey(key);

    if(!keyF) {
      return callback(new Error('invalid key'));
    }

    eEmitter.emit('drop', keyF);

    cacheClient.del(keyF, function(err) {
      if(err) {
        if(bypassCacheOnConnError && (err.code === 'ECONNREFUSED' || (typeof err.message === 'string' && err.message.indexOf('not available') !== -1))) {
          return callback(); // bypass cache
        }
        return callback(err);
      }

      return callback();
    });
  };

  // Generates keys
  var generateKey = function generateKey(key) {
    return (serverPartition ? encodeURI(serverPartition)+':' : '') + (key && key.segment ? encodeURI(key.segment) : '') + (key && key.id ? ':'+encodeURI(key.id) : '');
  };

  // Allows hook on events
  var on = function on(event, callback) {
    eEmitter.addListener(event, callback);
  };

  // Debug
  //flags = {debug: ['events']}; // for debug
  if(flags.debug instanceof Array) {
    // If events in debug flags
    if(flags.debug.indexOf('events') !== -1) {
      // Log all the events
      ['start', 'stop', 'get', 'set', 'drop', 'info', 'error'].forEach(function(event) {
        on(event, function(data) {
          console.log('\nDebug: ' + JSON.stringify({event: event, data:data}) + '\n');
        });
      });
    }
  }

  // Return
  return {
    start:               start,
    stop:                stop,
    isReady:             isReady,
    validateSegmentName: validateSegmentName,
    get:                 get,
    set:                 set,
    drop:                drop,
    generateKey:         generateKey,
    on:                  on
  };
};