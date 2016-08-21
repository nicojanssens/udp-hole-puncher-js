'use strict'

var dgram = require('dgram')
var helper = require('./helper')

describe('udp hole puncher', function () {
  this.timeout(10000)
  it('should properly return/release an existing UDP socket using chrome-dgrams ', function (done) {
    var child
    // start chrome app
    var launchChrome = function (listeningPort) {
      var env = {
        port: listeningPort
      }
      helper.browserify('chrome-app/client.js', env, function (error) {
        if (error) {
          done(error)
        }
        console.log('clean browserify build')
        child = helper.launchBrowser()
      })
    }
    // create udp server listening to messages from chrome app
    var server = dgram.createSocket('udp4')
    server.on('error',  function (error) {
      console.error(error)
      server.close()
      if (child) {
        child.kill()
        done(error)
      }
    })
    server.on('message', function (message) {
      console.log('receiving message ' + message)
      child.kill()
      if (message.toString() === 'done') {
        done()
      } else {
        done(message)
      }
    })
    server.on('listening', function () {
      var address = server.address()
      console.log('server listening ' + address.address + ':' + address.port)
      launchChrome(address.port)
    })
    // start udp server
    server.bind()
  })
})
