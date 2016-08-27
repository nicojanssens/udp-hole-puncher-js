[![CircleCI](https://circleci.com/gh/MicroMinion/udp-hole-puncher-js.svg?style=shield)](https://circleci.com/gh/MicroMinion/udp-hole-puncher-js)
[![npm](https://img.shields.io/npm/v/udp-hole-puncher.svg)](https://npmjs.org/package/udp-hole-puncher)

# UDP Hole Puncher

## Summary
JS library implementing a UDP hole punching protocol to connect two peers located behind NAT devices. Will not work when one or both peers are located behind a symmetric NAT box. In that case, you may need a relay server + a TURN lib (like [this one](https://github.com/nicojanssens/turn-js)) to facilitate communication between both peers.

## Features
- no rendez-vous server lock in
- verifies if bidirectional communication is possible
- can be browserified (to be used in chrome and cordova apps)

## Install
```
npm install udp-hole-puncher
```

## Usage
```js
var dgram = require('dgram')
var UdpHolePuncher = require('udp-hole-puncher')

// peer's public port and address
var peer = {
  port: 1234,
  addr: '1.2.3.4'
}
// local port
var myPort: 5678

// socket config
var socket = dgram.createSocket('udp4')
socket.on('error', function (error) {...} )
socket.on('message', function (message, rinfo) {...} )
socket.on('listening', function () {
  // puncher config
  var puncher = new UdpHolePuncher(socket)
  // when connection is established, send dummy message
  puncher.on('connected', function () {
    var message = new Buffer('hello')
    socket.send(message, 0, message.length, peer.port, peer.addr)
  })
  // error handling code
  puncher.on('error', function (error) {
    ...
  })
  // connect to peer (using its public address and port)
  puncher.connect(peer.addr, peer.port)
})

// bind socket
socket.bind(myPort)
```

## API

### `var puncher = new UdpHolePuncher(socket, args)`
Create a new udp-hole-puncher.

`socket` must be an operational datagram socket.

`args` specifies some optional config settings, including the maximum request attempts + timeout between every request attempt (ms). Default settings are `{
  maxRequestAttempts: 10,
  requestTimeout: 500
}`

### `puncher.connect(addr, port)`
Try to establish a connection with a peer using its public address and port. Note that to setup bidirectional communication, both peers must simultaneously execute a connect operation (initiating the punching protocol).

### `puncher.close()`
End execution of the hole punching protocol.

## Events

### `puncher.on('connected', function() {})`
Fired when the hole punching protocol completes and both peers can reach each other.  

### `puncher.on('reachable', function() {})`
Called when the other peer was able to reach this peer. No guarantee yet that bidirectional communication can be established.

### `puncher.on('timeout', function() {})`
Fired when the hole punching protocol timeouts.  

### `puncher.on('error', function(error) {})`
Fired when a fatal error occurs.    

## Chrome and cordova apps

```
gulp browserify [--production]
```
Puts `udp-hole-puncher.debug.js` and `udp-hole-puncher.min.js` in `build` folder. Can be used in chrome and cordova app. When integrating udp-hole-puncher in a cordova app, use `cordova-plugin-chrome-apps-sockets-udp`:
```
cordova plugin add https://github.com/MobileChromeApps/cordova-plugin-chrome-apps-sockets-udp
```

## Examples
See examples directory. Note that both peers should _not_ be located behind the same NAT device. To test this lib, deploy one peer on your home network and another one outside of that network -- for instance on a public cloud infrastructure.

To run this test example, execute the following cmd on two machines A and B:
```
server-A$ npm run-script peer -- --bind=12345 --addr=<PUBLIC ADDR OF B> --port=23456
server-B$ npm run-script peer -- --bind=23456 --addr=<PUBLIC ADDR OF A> --port=12345
```
