'use strict'

var dgram = require('dgram')
var UdpHolePuncher = require('../index')

// args
var argv = require('yargs')
  .usage('Usage: $0 [params]')
  .demand('b')
  .alias('b', 'bind')
  .nargs('b', 1)
  .default('b', '12345')
  .describe('b', 'local listening port')
  // remote address
  .demand('a')
  .alias('a', 'addr')
  .nargs('a', 1)
  .describe('a', 'public peer address')
  // remote port
  .demand('p')
  .alias('p', 'port')
  .nargs('p', 1)
  .default('p', '12345')
  .describe('p', 'public peer port')
  // help
  .help('h')
  .alias('h', 'help')
  .argv

var dataMessages = 10

// socket configuratio
var socket = dgram.createSocket('udp4')
socket.on('error', function (error) {
  console.error('socket error:\n' + error.stack)
  socket.close()
})
socket.on('message', function (message, rinfo) {
  var data = message.toString()
  console.log('receiving ' + data + ' from ' + rinfo.address + ':' + rinfo.port)
})
socket.on('listening', function () {
  var address = socket.address()
  console.log('listening at ' + address.address + ':' + address.port)
  // puncher configuration
  var puncher = new UdpHolePuncher(socket)
  puncher.on('connected', function () {
    console.log('woohoo, we can talk to ' + argv.addr + ':' + argv.port)
    sendData()
  })
  puncher.on('error', function (error) {
    console.log('woops, something went wrong: ' + error)
  })
  puncher.connect(argv.addr, argv.port)
})

// bind socket
socket.bind(argv.bind)

function sendData () {
  for (var i = 0; i < dataMessages; i++) {
    var data = 'message ' + i
    console.log('sending ' + data + ' to ' + argv.addr + ':' + argv.port)
    var message = new Buffer(data)
    socket.send(message, 0, message.length, argv.port, argv.addr)
  }
}
