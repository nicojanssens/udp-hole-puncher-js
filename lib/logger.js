'use strict'

var debug = require('debug')
var debugLog = debug('udp-hole-puncher')
var errorLog = debug('udp-hole-puncher:error')

function debug (message) {
  debugLog.log(message)
}

function info (message) {
  debugLog.log(message)
}

function error (message) {
  errorLog.log(message)
}

module.exports.debug = debug
module.exports.error = error
module.exports.info = info
