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

  var serverOptions = options || {},
      serverLocations,
      serverPartition,
      serverEvents,
      memcached,
      eEmitter;

  // Initialize event emitter
  var EEmitter = function EEmitter() { EventEmitter.call(this); };
  util.inherits(EEmitter, EventEmitter);
  EEmitter.prototype.emitAll = function(events, args) {
    for(var i = 0, len = events.length; i < len; i++) { this.emit(events[i], args); }
  };
  eEmitter = new EEmitter();
  eEmitter.on('error', function() { }); // prevent unhandled error event

  // Server options
  // REF: https://github.com/3rd-Eden/node-memcached/issues/170
  //      https://github.com/3rd-Eden/node-memcached/issues/145#issuecomment-27781592

  // Issues
  // failOverServers: https://github.com/3rd-Eden/memcached/issues/92

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

  // Server locations
  serverLocations = serverOptions.location || ((serverOptions.host || '127.0.0.1') + ':' + (serverOptions.port || 11211));
  serverOptions.location = serverLocations;
  //delete serverOptions.location;
  delete serverOptions.host;
  delete serverOptions.port;

  // Server partition
  serverPartition = serverOptions.partition || 'catbox';
  delete serverOptions.partition;

  // Events
  serverEvents = serverOptions.events || false;

  // Creates a connection to the cache server
  var start = function start(callback) {

    if(typeof callback !== 'function') {
      throw new Error('invalid callback function');
    }

    // If there is an instance then
    if(memcached) {
      return callback();
    }

    // Create instance
    memcached = new Memcached(serverLocations, serverOptions);

    // Set events
    if(serverEvents) {
      memcached.on('issue',        function(details) { eEmitter.emitAll(['issue',        'error', 'memcached'], details); });
      memcached.on('failure',      function(details) { eEmitter.emitAll(['failure',      'error', 'memcached'], details); });
      memcached.on('reconnecting', function(details) { eEmitter.emitAll(['reconnecting',          'memcached'], details); });
      memcached.on('reconnected',  function(details) { eEmitter.emitAll(['reconnected',           'memcached'], details); });
      memcached.on('reconnect',    function(details) { eEmitter.emitAll(['reconnect',             'memcached'], details); });
      memcached.on('remove',       function(details) { eEmitter.emitAll(['remove',       'error', 'memcached'], details); });
    }

    return callback();
  };

  // Ends the cache server connection
  var stop = function stop() {
    // If there is an instance then
    if(memcached) {
      memcached.end();  // end connection
      memcached = null; // cleanup
    }
  };

  // Returns whether the cache server is ready or not
  var isReady = function isReady() {
    return (!!memcached);
  };

  // Validates segment name
  var validateSegmentName = function validateSegmentName(name) {
    // Check name for null, space and tab characters
    if(!name || name.indexOf('\n') !== -1 || name.indexOf('\0') !== -1 || name.indexOf('\t') !== -1 || name.indexOf(' ') !== -1) {
      return new Error('invalid segment name');
    }
    return null; // catbox wants null
  };

  // Gets a value for the given key
  var get = function get(key, callback) {

    if(typeof callback !== 'function') {
      throw new Error('invalid callback function');
    } else if(!isReady()) {
      return callback(new Error('cache server is not ready'));
    }

    // Get cache value
    memcached.get(generateKey(key), function(err, result) {
      if(err) {
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
      } catch(e) {}

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
    } else if(!key) {
      return callback(new Error('invalid cache key'));
    } else if(typeof ttl !== 'number') {
      return callback(new Error('invalid ttl'));
    } else if(!isReady()) {
      return callback(new Error('cache server is not ready'));
    }

    // Prepare cache content
    var envelope = {item: value, stored: Date.now(), ttl: ttl},
        envelopeStr;

    try {
      envelopeStr = JSON.stringify(envelope);
    } catch(e) {
      return callback(e);
    }

    // Set cache
    var ttlSec = Math.max(1, Math.floor(ttl / 1000)); // min ttl is 1 sec

    memcached.set(generateKey(key), envelopeStr, ttlSec, function(err) {
      if(err) {
        return callback(err);
      }
      return callback();
    });
  };

  // Remove the given key
  var drop = function drop(key, callback) {

    if(typeof callback !== 'function') {
      throw new Error('invalid callback function');
    } else if(!key) {
      return callback(new Error('invalid cache key'));
    } else if(!isReady()) {
      return callback(new Error('cache server is not ready'));
    }

    // Delete cache
    memcached.del(generateKey(key), function(err) {
      if(err) {
        return callback(err);
      }
      return callback();
    });
  };

  // Generates keys
  var generateKey = function generateKey(key) {
    return encodeURIComponent(serverPartition) + ':' + ((key && encodeURIComponent(key.segment)) || undefined) + ':' + ((key && encodeURIComponent(key.id) || undefined));
  };

  // Allows hook on events
  var on = function on(event, callback) {
    eEmitter.addListener(event, callback);
  };

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
    settings:            serverOptions,
    on:                  on
  };
};