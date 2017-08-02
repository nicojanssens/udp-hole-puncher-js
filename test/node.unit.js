// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');
const dgram = require('dgram');
const UdpHolePuncher = require('../index');
const winston = require('winston');

winston.level = 'debug';

const expect = chai.expect;

// eslint-disable-next-line no-undef
describe('udp hole puncher', () => {
  // eslint-disable-next-line no-undef
  it('should properly return/release an existing UDP socket ', (done) => {
    const onMessage = (message, rinfo) => {
      console.log(`incoming message: ${message} from ${JSON.stringify(rinfo)}`);
      done(new Error(`not expecting incoming message ${message} from ${JSON.stringify(rinfo)}`));
    };
    const onError = (error) => {
      console.error(`socket error:\n${error.stack}`);
      done(error);
    };
    // create socket
    const socket = dgram.createSocket('udp4');
    socket.on('message', onMessage);
    socket.on('error', onError);
    socket.on('listening', () => {
      const puncher = new UdpHolePuncher(socket);
      puncher.on('error', (error) => {
        console.error(`woops, something went wrong: ${error}`);
        done(error);
      });
      puncher.connect('127.0.0.1', 32546);
      expect(socket.listeners('message').length).to.equal(1);
      expect(socket.listeners('error').length).to.equal(1);
      expect(socket.listeners('message')[0]).to.not.equal(onMessage);
      expect(socket.listeners('error')[0]).to.not.equal(onError);
      setInterval(() => {
        puncher.close();
        // check the socket's event listeners (should not include any puncher handlers)
        expect(socket.listeners('message').length).to.equal(1);
        expect(socket.listeners('error').length).to.equal(1);
        expect(socket.listeners('message')[0]).to.equal(onMessage);
        expect(socket.listeners('error')[0]).to.equal(onError);
        done();
      }, 100);
    });
    socket.bind(32547);
  });
});
