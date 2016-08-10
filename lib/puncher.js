// TODO: error when reachable but not connected

'use strict'

var events = require('events')
var hat = require('hat')
var merge = require('merge')
var util = require('util')
var winston = require('winston')
var winstonWrapper = require('winston-meta-wrapper')

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
  // logging
  this._log = winstonWrapper(winston)
  this._log.addMeta({
    module: 'udp-hole-puncher'
  })
  // check if socket is defined
  if (socket === undefined) {
    var errorMsg = 'udp socket is undefined'
    this._log.error(errorMsg)
    throw new Error(errorMsg)
  }
  // merge args with defaults
  var margs = merge(Object.create(UdpHolePuncher.DEFAULTS), args)
  // init
  this._id = hat()
  this._attempts = margs.maxRequestAttempts
  this._timeout = margs.requestTimeout
  events.EventEmitter.call(this)
  this._socket = socket
  this._initSocket()
  // done
  this._log.addMeta({
    id: this._id
  })
  this._log.debug('init complete')
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
      self._log.error('failed to connect with ' + addr + ':' + port)
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
  var message = this._composeRequest(this._id)
  this._socket.send(message, 0, message.length, port, addr)
  this._log.debug('sent request ' + this._id + '  to ' + addr + ':' + port)
}

UdpHolePuncher.prototype._sendAck = function (addr, port) {
  var message = this._composeAck(this._remoteId)
  this._socket.send(message, 0, message.length, port, addr)
  this._log.debug('sent ack ' + this._remoteId + ' to ' + addr + ':' + port)
}

/** Incoming message */

UdpHolePuncher.prototype._onMessage = function () {
  var self = this
  return function (bytes, rinfo) {
    self._log.debug('receiving message from ' + JSON.stringify(rinfo))
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
  this._log.debug('receiving remote token ' + id + ' from ' + rinfo.address + ':' + rinfo.port)
  this._remoteId = id
  this._receivingMessages = true
  this._sendAck(rinfo.address, rinfo.port)
  this.emit('reachable')
  this._verifyConnection()
}

UdpHolePuncher.prototype._onAck = function (bytes, rinfo) {
  var ackId = bytes.toString()
  this._log.debug('receiving ack with token ' + ackId + ' from ' + rinfo.address + ':' + rinfo.port)
  if (ackId !== this._id) {
    this._log.debug('ack contains incorrect id, dropping on the floor')
    return
  }
  this._messageDeliveryConfirmed = true
  clearInterval(this._sendRequestInterval)
  this._verifyConnection()
}

UdpHolePuncher.prototype._onRegularMessage = function (bytes, rinfo) {
  this._log.debug('receiving regular message while establishing a connection')
  // forward to original message listeners
  this._messageListeners.forEach(function (callback) {
    callback(bytes, rinfo)
  })
}

UdpHolePuncher.prototype._verifyConnection = function () {
  if (this._receivingMessages && this._messageDeliveryConfirmed) {
    this._log.debug('bi-directional connection established')
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
  var self = this
  return function (error) {
    var errorMsg = 'socket error: ' + error
    self._log.error(errorMsg)
    self.emit('error', error)
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
