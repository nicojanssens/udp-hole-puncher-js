'use strict'

var debugLog = require('debug')('udp-hole-puncher')
var errorLog = require('debug')('udp-hole-puncher:error')

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
