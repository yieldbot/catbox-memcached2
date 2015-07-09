## catbox-memcached2

[![NPM][npm-image]][npm-url] [![Build Status][travis-image]][travis-url]

Yet another memcached adapter for [catbox](https://github.com/hapijs/catbox).
Ready to use for production with event emitter support.

### Installation

```
npm install catbox-memcached2
```

### Usage

#### Options

* `location` - Memcached server location. Default `["localhost:11211"]`
* `host` - Memcached server host (Can not be used with location). Default `localhost`
* `port` - Memcached server port (Can not be used with location). Default `11211`
* `partition` - Cache key prefix. Default: `catbox`
* `poolSize` - Connection pool size. Default `10`
* `minTimeout` - Connection pool retry min delay before retrying. Default `0`
* `retries` - Connection pool retries to pull connection from pool. Default `0`
* `reconnect` - Reconnect delay after server is dead. Default `1000` ms
* `failures` - Number of failure before marked server as dead. Default `1`
* `retry` - Retry delay when server has an error. Default `1000` ms
* `idle` - Idle time before removing connection from pool. Default `60000` ms 
* `debug` - Debug mode. Default `false`
* `events` - Whether events are emitted or not. Default `false`


#### JSON manifest for Hapi server options

```javascript
{
  "server": {
    "cache": [
      {
        "engine": "catbox-memcached2",
        "partition": "test_",
        "location": ["localhost:11211"]
      }
    ]
  }
}
```

*See [catbox client](https://github.com/hapijs/catbox#client) and 
[memcached](https://github.com/3rd-Eden/memcached#options)
for more details and options.*

### License

Licensed under The MIT License (MIT)  
For the full copyright and license information, please view the LICENSE.txt file.

[npm-url]: http://npmjs.org/package/catbox-memcached2
[npm-image]: https://badge.fury.io/js/catbox-memcached2.png

[travis-url]: https://travis-ci.org/cmfatih/catbox-memcached2
[travis-image]: https://travis-ci.org/cmfatih/catbox-memcached2.svg?branch=master