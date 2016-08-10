'use strict'

var dgram = require('dgram')
var UdpHolePuncher = require('../index')
var winston = require('winston')
winston.level = 'debug'

var chai = require('chai')
var expect = chai.expect

describe('udp hole puncher', function () {
  it('should properly return/release an existing UDP socket ', function (done) {
    var onMessage = function (message, rinfo) {
      console.log('incoming message: ' + message + ' from ' + JSON.stringify(rinfo))
      done(new Error('not expecting incoming message ' + message + ' from ' + JSON.stringify(rinfo)))
    }
    var onError = function (error) {
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
      setInterval(function () {
        puncher.close()
        // check the socket's event listeners (should not include any puncher handlers)
        expect(socket.listeners('message').length).to.equal(1)
        expect(socket.listeners('error').length).to.equal(1)
        expect(socket.listeners('message')[0]).to.equal(onMessage)
        expect(socket.listeners('error')[0]).to.equal(onError)
        done()
      }, 100)
    })
    socket.bind(32547)
  })

})
