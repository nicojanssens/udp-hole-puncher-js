'use strict'

var dgram = require('dgram')
var gulp = require('gulp')
var gulpfile = require('../../gulpfile')
var listeningPort = 12345

var modules  = {
  'dgram': 'chrome-dgram',
  'winston': '../../lib/logger'
}

describe('udp hole puncher', function () {
  this.timeout(100000)
  it('should properly return/release an existing UDP socket using dgrams ', function (done) {
    var child
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
      console.log('server listening at ' + address.address + ':' + address.port)
      // start gulp task
      gulp.start('test')
    })
    // start udp server
    server.bind(listeningPort)
    // build bundle.js
    gulp.task('test', function () {
      var destFile = 'bundle.js'
      var destFolder = './cordova-app/www/js'
      var entry = './test.js'
      return gulpfile
        .bundle(entry, modules, destFile, destFolder, true)
        .on('end', onBundleReady)
    })
    var onBundleReady = function () {
      console.log('clean browserify build, please launch cordova app')
      //child = chrome.launchApp()
    }
  })
})