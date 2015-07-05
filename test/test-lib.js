/* jslint node: true */
/* global describe: false, it: false */
'use strict';

var Memcached2 = require('../'),
    expect     = require('chai').expect;

// Tests

describe('catbox-memcached2', function() {

  describe('lib', function() {

    it('should create a connection', function(done) {
      var client = new Memcached2();

      client.start(function(err) {
        expect(err).to.equal(undefined);
        expect(client.isReady()).to.equal(true);
        done();
      });
    });

    it('should end the connection', function(done) {
      var client = new Memcached2();

      client.start(function(err) {
        expect(err).to.equal(undefined);
        expect(client.isReady()).to.equal(true);
        client.stop();
        expect(client.isReady()).to.equal(false);
        done();
      });
    });

    it('should set and get an item', function(done) {
      var client = new Memcached2();

      client.start(function(err) {
        expect(err).to.equal(undefined);
        expect(client.isReady()).to.equal(true);

        var key = {id: 'foo', segment: 'test'};
        client.set(key, 'bar', 1000, function(err) {
          expect(err).to.equal(undefined);

          client.get(key, function(err, result) {
            expect(err).to.equal(null);
            expect(result).to.be.a('object');
            expect(result.item).to.equal('bar');
            done();
          });
        });
      });
    });

    it('should fail to set an item due to value', function(done) {
      var client = new Memcached2();

      client.start(function(err) {
        expect(err).to.equal(undefined);
        expect(client.isReady()).to.equal(true);

        var key = {id: 'bar', segment: 'test'},
            val = {'baz': 'qux'};
        val.val = val;
        client.set(key, val, 1000, function(err) {
          expect(err.message).to.equal('Converting circular structure to JSON');
          done();
        });
      });
    });

    it('should fail to set an item due to key', function(done) {
      var client = new Memcached2();

      client.start(function(err) {
        expect(err).to.equal(undefined);
        expect(client.isReady()).to.equal(true);

        client.set(null, {}, 1000, function(err) {
          expect(err.message).to.equal('invalid cache key');
          done();
        });
      });
    });

    it('should fail to set an item due to ttl', function(done) {
      var client = new Memcached2();

      client.start(function(err) {
        expect(err).to.equal(undefined);
        expect(client.isReady()).to.equal(true);

        client.set({id: 'baz', segment: 'test'}, {}, 'boom', function(err) {
          expect(err.message).to.equal('invalid ttl');
          done();
        });
      });
    });

    it('should return null - key', function(done) {
      var client = new Memcached2();

      client.start(function(err) {
        expect(err).to.equal(undefined);
        expect(client.isReady()).to.equal(true);

        client.get(null, function(err, result) {
          expect(err).to.equal(null);
          expect(result).to.equal(null);

          client.get({}, function(err, result) {
            expect(err).to.equal(null);
            expect(result).to.equal(null);
            done();
          });
        });
      });
    });

    it('should drop an item', function(done) {
      var client = new Memcached2();

      client.start(function(err) {
        expect(err).to.equal(undefined);
        expect(client.isReady()).to.equal(true);

        var key = {id: 'qux', segment: 'boom'};
        client.set(key, 'foo', 1, function(err) {
          expect(err).to.equal(undefined);
          client.drop(key, function(err) {
            expect(err).to.equal(undefined);
            client.get(key, function(err, result) {
              expect(err).to.equal(null);
              expect(result).to.equal(null);
              done();
            });
          });
        });
      });
    });

    it('should validate segment', function(done) {
      var client = new Memcached2();

      expect(client.validateSegmentName().message).to.equal('invalid segment name');
      expect(client.validateSegmentName('\n').message).to.equal('invalid segment name');
      expect(client.validateSegmentName('\0').message).to.equal('invalid segment name');
      expect(client.validateSegmentName('\t').message).to.equal('invalid segment name');
      expect(client.validateSegmentName(' ').message).to.equal('invalid segment name');
      done();
    });

    it('should return null - ttl', function(done) {
      var client = new Memcached2();

      client.start(function(err) {
        expect(err).to.equal(undefined);
        expect(client.isReady()).to.equal(true);

        var key = {id: 'baz', segment: 'qux'};
        client.set(key, 'boom', 1, function(err) {
          expect(err).to.equal(undefined);
          setTimeout(function() {
            client.get(key, function(err, result) {
              expect(err).to.equal(null);
              expect(result).to.equal(null);
              done();
            });
          }, 2000);
        });
      });
    });
  });
});