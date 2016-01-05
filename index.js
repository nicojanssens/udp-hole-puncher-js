// TODO: error when reachable but not connected
// tests
// README

'use strict'

// var dgram = require('dgram')
var events = require('events')
var hat = require('hat')
var merge = require('merge')
var util = require('util')
var winston = require('winston')

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
    var error = '[udp-hole-puncher] udp socket is undefined'
    winston.error(error)
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
  winston.debug('[udp-hole-puncher] init complete: id = ' + this._id)
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
      self.sendRequest(addr, port)
    } else {
      winston.error('[udp-hole-puncher] failed to connect with ' + addr + ':' + port)
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

UdpHolePuncher.prototype.sendRequest = function (addr, port) {
  winston.debug('[udp-hole-puncher] sending request id ' + this._id + ' to ' + addr + ':' + port)
  var message = this.composeRequest(this._id)
  this._socket.send(message, 0, message.length, port, addr)
}

UdpHolePuncher.prototype.sendAck = function (addr, port) {
  winston.debug('[udp-hole-puncher] sending ack id ' + this._remoteId + ' to ' + addr + ':' + port)
  var message = this.composeAck(this._remoteId)
  this._socket.send(message, 0, message.length, port, addr)
}

/** Incoming message */

UdpHolePuncher.prototype.onMessage = function () {
  var self = this
  return function (bytes, rinfo) {
    winston.debug('[udp-hole-puncher] receiving message from ' + JSON.stringify(rinfo))
    var type = bytes.readUInt16BE(0)
    switch (type) {
      case UdpHolePuncher.PACKET.REQUEST:
        self.onRequest(bytes.slice(2), rinfo)
        break
      case UdpHolePuncher.PACKET.ACK:
        self.onAck(bytes.slice(2), rinfo)
        break
      default:
        self.onRegularMessage(bytes, rinfo)
    }
  }
}

UdpHolePuncher.prototype.onRequest = function (bytes, rinfo) {
  var id = bytes.toString()
  winston.debug('[udp-hole-puncher] receiving remote token ' + id + ' from ' + rinfo.address + ':' + rinfo.port)
  this._remoteId = id
  this._receivingMessages = true
  this.sendAck(rinfo.address, rinfo.port)
  this.emit('reachable')
  this._verifyConnection()
}

UdpHolePuncher.prototype.onAck = function (bytes, rinfo) {
  var ackId = bytes.toString()
  winston.debug('[udp-hole-puncher] receiving ack with token ' + ackId + ' from ' + rinfo.address + ':' + rinfo.port)
  if (ackId !== this._id) {
    winston.debug('[udp-hole-puncher] ack contains incorrect id, dropping on the floor')
    return
  }
  this._messageDeliveryConfirmed = true
  clearInterval(this._sendRequestInterval)
  this._verifyConnection()
}

UdpHolePuncher.prototype.onRegularMessage = function (bytes, rinfo) {
  winston.warn('[udp-hole-puncher] receiving regular message while establishing a connection')
  // forward to original message listeners
  this._messageListeners.forEach(function (callback) {
    callback(bytes, rinfo)
  })
}

UdpHolePuncher.prototype._verifyConnection = function () {
  if (this._receivingMessages && this._messageDeliveryConfirmed) {
    winston.info('[udp-hole-puncher] bi-directional connection established')
    this._restoreSocket()
    this.emit('connected')
  }
}

/** Message composition */

UdpHolePuncher.prototype.composeRequest = function (id) {
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

UdpHolePuncher.prototype.composeAck = function (id) {
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
UdpHolePuncher.prototype.onFailure = function () {
  return function (error) {
    var errorMsg = '[udp-hole-puncher] socket error: ' + error
    winston.error(errorMsg)
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
  this._socket.on('message', this.onMessage())
  this._socket.on('error', this.onFailure())
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
