## catbox-memcached2

[![NPM][npm-image]][npm-url] [![Build Status][travis-image]][travis-url]

Yet another memcached adapter for [catbox](https://github.com/hapijs/catbox).

### Installation

```
npm install catbox-memcached2
```

### Usage

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