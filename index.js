// TODO: error when reachable but not connected

'use strict'

// var dgram = require('dgram')
var events = require('events')
var hat = require('hat')
var merge = require('merge')
var util = require('util')

var debug = require('debug')
var debugLog = debug('udp-hole-puncher')
var errorLog = debug('udp-hole-puncher:error')

/**
 * UDP hole puncher
 *
 * @constructor
 * @fires UdpHolePuncher#reachable
 * @fires UdpHolePuncher#connected
 * @fires UdpHolePuncher#timeout
 * @fires UdpHolePuncher#error
 */
var UdpHolePuncher = function (socket, args) {
  if (socket === undefined) {
    var error = 'udp socket is undefined'
    errorLog(error)
    throw new Error(error)
  }
  var margs = merge(Object.create(UdpHolePuncher.DEFAULTS), args)
  // init
  this._id = hat()
  this._attempts = margs.maxRequestAttempts
  this._timeout = margs.requestTimeout
  events.EventEmitter.call(this)
  // create new socket if undefined
  // var socket = (udpSocket === undefined) ? dgram.createSocket('udp4') : udpSocket
  this._socket = socket
  this._initSocket()
  // done
  debugLog('init complete: id = ' + this._id)
}

// Inherit EventEmitter
util.inherits(UdpHolePuncher, events.EventEmitter)

UdpHolePuncher.DEFAULTS = {
  maxRequestAttempts: 10,
  requestTimeout: 500
}

UdpHolePuncher.PACKET = {
  REQUEST: 0x9000,
  ACK: 0x9001
}

/** Connect and close */

UdpHolePuncher.prototype.connect = function (addr, port) {
  var self = this
  this._sendRequestInterval = setInterval(function () {
    if (self._attempts > 0) {
      self._attempts--
      self._sendRequest(addr, port)
    } else {
      errorLog('failed to connect with ' + addr + ':' + port)
      clearInterval(self._sendRequestInterval)
      self._restoreSocket()
      self.emit('timeout')
    }
  }, this._timeout)
}

UdpHolePuncher.prototype.close = function () {
  if (this._sendRequestInterval) {
    clearInterval(this._sendRequestInterval)
  }
  this._restoreSocket()
}

/** Outgoing messages */

UdpHolePuncher.prototype._sendRequest = function (addr, port) {
  debugLog('sending request id ' + this._id + ' to ' + addr + ':' + port)
  var message = this._composeRequest(this._id)
  this._socket.send(message, 0, message.length, port, addr)
}

UdpHolePuncher.prototype._sendAck = function (addr, port) {
  debugLog('sending ack id ' + this._remoteId + ' to ' + addr + ':' + port)
  var message = this._composeAck(this._remoteId)
  this._socket.send(message, 0, message.length, port, addr)
}

/** Incoming message */

UdpHolePuncher.prototype._onMessage = function () {
  var self = this
  return function (bytes, rinfo) {
    debugLog('receiving message from ' + JSON.stringify(rinfo))
    var type = bytes.readUInt16BE(0)
    switch (type) {
      case UdpHolePuncher.PACKET.REQUEST:
        self._onRequest(bytes.slice(2), rinfo)
        break
      case UdpHolePuncher.PACKET.ACK:
        self._onAck(bytes.slice(2), rinfo)
        break
      default:
        self._onRegularMessage(bytes, rinfo)
    }
  }
}

UdpHolePuncher.prototype._onRequest = function (bytes, rinfo) {
  var id = bytes.toString()
  debugLog('receiving remote token ' + id + ' from ' + rinfo.address + ':' + rinfo.port)
  this._remoteId = id
  this._receivingMessages = true
  this._sendAck(rinfo.address, rinfo.port)
  this.emit('reachable')
  this._verifyConnection()
}

UdpHolePuncher.prototype._onAck = function (bytes, rinfo) {
  var ackId = bytes.toString()
  debugLog('receiving ack with token ' + ackId + ' from ' + rinfo.address + ':' + rinfo.port)
  if (ackId !== this._id) {
    debugLog('ack contains incorrect id, dropping on the floor')
    return
  }
  this._messageDeliveryConfirmed = true
  clearInterval(this._sendRequestInterval)
  this._verifyConnection()
}

UdpHolePuncher.prototype._onRegularMessage = function (bytes, rinfo) {
  debugLog('receiving regular message while establishing a connection')
  // forward to original message listeners
  this._messageListeners.forEach(function (callback) {
    callback(bytes, rinfo)
  })
}

UdpHolePuncher.prototype._verifyConnection = function () {
  if (this._receivingMessages && this._messageDeliveryConfirmed) {
    debugLog('bi-directional connection established')
    this._restoreSocket()
    this.emit('connected')
  }
}

/** Message composition */

UdpHolePuncher.prototype._composeRequest = function (id) {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(UdpHolePuncher.PACKET.REQUEST)
  // value
  var valueBytes = new Buffer(id)
  // combination
  var result = Buffer.concat([typeBytes, valueBytes])
  // done
  return result
}

UdpHolePuncher.prototype._composeAck = function (id) {
  // type
  var typeBytes = new Buffer(2)
  typeBytes.writeUInt16BE(UdpHolePuncher.PACKET.ACK)
  // value
  var valueBytes = new Buffer(id)
  // combination
  var result = Buffer.concat([typeBytes, valueBytes])
  // done
  return result
}

/** Socket errors */

// Error handler
UdpHolePuncher.prototype._onFailure = function () {
  return function (error) {
    var errorMsg = 'socket error: ' + error
    errorLog(errorMsg)
    this.emit('error', error)
    throw new Error(errorMsg)
  }
}

/** Socket config */

UdpHolePuncher.prototype._initSocket = function () {
  var self = this
  // store original message and error listeners, if any
  this._messageListeners = this._socket.listeners('message')
  this._errorListeners = this._socket.listeners('error')
  // temp remove these listeners ...
  this._messageListeners.forEach(function (callback) {
    self._socket.removeListener('message', callback)
  })
  this._errorListeners.forEach(function (callback) {
    self._socket.removeListener('error', callback)
  })
  // ... and put my handlers in place
  this._socket.on('message', this._onMessage())
  this._socket.on('error', this._onFailure())
}

UdpHolePuncher.prototype._restoreSocket = function () {
  var self = this
  // remove my listeners
  this._socket.listeners('message').forEach(function (callback) {
    self._socket.removeListener('message', callback)
  })
  this._socket.listeners('error').forEach(function (callback) {
    self._socket.removeListener('error', callback)
  })
  // restore the original listeners
  this._messageListeners.forEach(function (callback) {
    self._socket.on('message', callback)
  })
  this._errorListeners.forEach(function (callback) {
    self._socket.on('error', callback)
  })
  // and remove refs to these original listeners
  this._messageListeners = this._errorListeners = []
}

module.exports = UdpHolePuncher
