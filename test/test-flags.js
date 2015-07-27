/* jslint node: true */
/* global describe: false, it: false */
'use strict';

var Client = require('../'),
    expect = require('chai').expect;

// Tests

describe('flags', function() {

  var getClient = function getClient() {
    return new Client({location: '127.0.0.1:11212', 'flags': {'bypassCacheOnConnError': true}});
  };

  it('should not fail', function(done) {
    var client = getClient();

    client.start(function(err) {
      expect(err).to.equal(undefined);
      expect(client.isReady()).to.equal(true);

      var key = {id: 'foo', segment: 'test'};
      client.set(key, 'bar', 1000, function(err) {
        expect(err).to.equal(undefined);

        client.get(key, function(err, result) {
          expect(err).to.equal(null);
          expect(result).to.equal(null);

          client.drop(key, function(err) {
            expect(err).to.equal(undefined);
            done();
          });
        });
      });
    });
  });

});