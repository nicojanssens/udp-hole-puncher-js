'use strict'

var chai = require('chai')
var dgram = require('dgram') // browserify will replace this with chrome-dgram
var expect = chai.expect
var UdpHolePuncher = require('../../index')

var port = 12345

// execute test
var runTest = function () {
  function done(error) {
    var message = (error === undefined)? 'done': error
    socket.send(message, 0, message.length, port, '127.0.0.1')
  }

  function onMessage (message, rinfo) {
    console.log('incoming message: ' + message + ' from ' + JSON.stringify(rinfo))
    done('not expecting incoming message ' + message + ' from ' + JSON.stringify(rinfo))
  }
  function onError (error) {
    console.error('socket error:\n' + error.stack)
    done(error)
  }

  // create socket
  var socket = dgram.createSocket('udp4')
  socket.on('message', onMessage)
  socket.on('error', onError)
  socket.on('listening', function () {
    var puncher = new UdpHolePuncher(socket)
    puncher.on('error', function (error) {
      console.error('woops, something went wrong: ' + error)
      done(error)
    })
    puncher.connect('127.0.0.1', 32546)
    expect(socket.listeners('message').length).to.equal(1)
    expect(socket.listeners('error').length).to.equal(1)
    expect(socket.listeners('message')[0]).to.not.equal(onMessage)
    expect(socket.listeners('error')[0]).to.not.equal(onError)
    console.log('all good!')
    setInterval(function () {
      puncher.close()
      // // check the socket's event listeners (should not include any puncher handlers)
      // expect(socket.listeners('message').length).to.equal(1)
      // expect(socket.listeners('error').length).to.equal(1)
      // expect(socket.listeners('message')[0]).to.equal(onMessage)
      // expect(socket.listeners('error')[0]).to.equal(onError)
      done()
    }, 1000)
  })
  // bind socket
  socket.bind(32547)
}

// start test
if (window.cordova === undefined) {
  runTest()
} else {
  document.addEventListener('deviceready', runTest, false)
}
