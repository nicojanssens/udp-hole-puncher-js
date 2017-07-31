// TODO: error when reachable but not connected

const events = require('events');
const hat = require('hat');
const merge = require('merge');
const winston = require('winston');
const winstonWrapper = require('winston-meta-wrapper');

/**
 * UDP hole puncher
 *
 * @constructor
 * @fires UdpHolePuncher#reachable
 * @fires UdpHolePuncher#connected
 * @fires UdpHolePuncher#timeout
 * @fires UdpHolePuncher#error
 */
class UdpHolePuncher extends events.EventEmitter {
  constructor(socket, args) {
    super();
    // logging
    this.log = winstonWrapper(winston);
    this.log.addMeta({
      module: 'udp-hole-puncher',
    });
    // check if socket is defined
    if (socket === undefined) {
      const errorMsg = 'udp socket is undefined';
      this.log.error(errorMsg);
      throw new Error(errorMsg);
    }
    // merge args with defaults
    const margs = merge(Object.create(UdpHolePuncher.DEFAULTS), args);
    // init
    this.id = hat();
    this.attempts = margs.maxRequestAttempts;
    this.timeout = margs.requestTimeout;

    this.socket = socket;
    this.initSocket();
    // done
    this.log.addMeta({
      id: this.id,
    });
    this.log.debug('init complete');
  }

  /** Connect and close */

  connect(addr, port) {
    this.sendRequestInterval = setInterval(() => {
      if (this.attempts > 0) {
        this.attempts -= 1;
        this.sendRequest(addr, port);
      } else {
        this.log.error(`failed to connect with ${addr}:${port}`);
        clearInterval(this.sendRequestInterval);
        this.restoreSocket();
        this.emit('timeout');
      }
    }, this.timeout);
  }

  close() {
    if (this.sendRequestInterval) {
      clearInterval(this.sendRequestInterval);
    }
    this.restoreSocket();
  }

  /** Outgoing messages */

  sendRequest(addr, port) {
    const message = this.composeRequest(this.id);
    this.socket.send(message, 0, message.length, port, addr);
    this.log.debug(`sent request ${this.id}  to ${addr}:${port}`);
  }

  sendAck(addr, port) {
    const message = this.composeAck(this.remoteId);
    this.socket.send(message, 0, message.length, port, addr);
    this.log.debug(`sent ack ${this.remoteId} to ${addr}:${port}`);
  }

  /** Incoming message */

  onMessage() {
    return (bytes, rinfo) => {
      this.log.debug(`receiving message from ${JSON.stringify(rinfo)}`);
      const type = bytes.readUInt16BE(0);
      switch (type) {
        case UdpHolePuncher.PACKET.REQUEST:
          this.onRequest(bytes.slice(2), rinfo);
          break;
        case UdpHolePuncher.PACKET.ACK:
          this.onAck(bytes.slice(2), rinfo);
          break;
        default:
          this.onRegularMessage(bytes, rinfo);
      }
    };
  }

  onRequest(bytes, rinfo) {
    const id = bytes.toString();
    this.log.debug(`receiving remote token ${id} from ${rinfo.address}:${rinfo.port}`);
    this.remoteId = id;
    this.receivingMessages = true;
    this.sendAck(rinfo.address, rinfo.port);
    this.emit('reachable');
    this.verifyConnection();
  }

  onAck(bytes, rinfo) {
    const ackId = bytes.toString();
    this.log.debug(`receiving ack with token ${ackId} from ${rinfo.address}:${rinfo.port}`);
    if (ackId !== this.id) {
      this.log.debug('ack contains incorrect id, dropping on the floor');
      return;
    }
    this.messageDeliveryConfirmed = true;
    clearInterval(this.sendRequestInterval);
    this.verifyConnection();
  }

  onRegularMessage(bytes, rinfo) {
    this.log.debug('receiving regular message while establishing a connection');
    // forward to original message listeners
    this.messageListeners.forEach((callback) => {
      callback(bytes, rinfo);
    });
  }

  verifyConnection() {
    if (this.receivingMessages && this.messageDeliveryConfirmed) {
      this.log.debug('bi-directional connection established');
      this.restoreSocket();
      this.emit('connected');
    }
  }

  /** Message composition */

  composeRequest(id) {
    this.log.debug(`composing request message with id ${id}`);
    // type
    const typeBytes = new Buffer(2);
    typeBytes.writeUInt16BE(UdpHolePuncher.PACKET.REQUEST);
    // value
    const valueBytes = new Buffer(id);
    // combination
    const result = Buffer.concat([typeBytes, valueBytes]);
    // done
    return result;
  }

  composeAck(id) {
    this.log.debug(`composing ack message with id ${id}`);
    // type
    const typeBytes = new Buffer(2);
    typeBytes.writeUInt16BE(UdpHolePuncher.PACKET.ACK);
    // value
    const valueBytes = new Buffer(id);
    // combination
    const result = Buffer.concat([typeBytes, valueBytes]);
    // done
    return result;
  }

  /** Socket errors */

  // Error handler
  onFailure() {
    return (error) => {
      const errorMsg = `socket error: ${error}`;
      this.log.error(errorMsg);
      this.emit('error', error);
      throw new Error(errorMsg);
    };
  }

  /** Socket config */

  initSocket() {
    // store original message and error listeners, if any
    this.messageListeners = this.socket.listeners('message');
    this.errorListeners = this.socket.listeners('error');
    // temp remove these listeners ...
    this.messageListeners.forEach((callback) => {
      this.socket.removeListener('message', callback);
    });
    this.errorListeners.forEach((callback) => {
      this.socket.removeListener('error', callback);
    });
    // ... and put my handlers in place
    this.socket.on('message', this.onMessage());
    this.socket.on('error', this.onFailure());
  }

  restoreSocket() {
    // remove my listeners
    this.socket.listeners('message').forEach((callback) => {
      this.socket.removeListener('message', callback);
    });
    this.socket.listeners('error').forEach((callback) => {
      this.socket.removeListener('error', callback);
    });
    // restore the original listeners
    this.messageListeners.forEach((callback) => {
      this.socket.on('message', callback);
    });
    this.errorListeners.forEach((callback) => {
      this.socket.on('error', callback);
    });
    // and remove refs to these original listeners
    this.messageListeners = [];
    this.errorListeners = [];
  }
}

UdpHolePuncher.DEFAULTS = {
  maxRequestAttempts: 10,
  requestTimeout: 500,
};

UdpHolePuncher.PACKET = {
  REQUEST: 0x9000,
  ACK: 0x9001,
};

module.exports = UdpHolePuncher;
