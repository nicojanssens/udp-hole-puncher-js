const dgram = require('dgram');
const UdpHolePuncher = require('../index');

// eslint-disable-next-line import/no-extraneous-dependencies
const argv = require('yargs')
  .usage('Usage: $0 [params]')
  .demand('b')
  .alias('b', 'bind')
  .nargs('b', 1)
  .default('b', '12345')
  .describe('b', 'local listening port')
  // remote address
  .demand('a')
  .alias('a', 'addr')
  .nargs('a', 1)
  .describe('a', 'public peer address')
  // remote port
  .demand('p')
  .alias('p', 'port')
  .nargs('p', 1)
  .default('p', '12345')
  .describe('p', 'public peer port')
  // help
  .help('h')
  .alias('h', 'help')
  .argv;

const dataMessages = 10;

// create new socket
const socket = dgram.createSocket('udp4');
// send data
const sendData = () => {
  for (let i = 0; i < dataMessages; i += 1) {
    const data = `message ${i}`;
    console.log(`sending ${data} to ${argv.addr}:${argv.port}`);
    const message = new Buffer(data);
    socket.send(message, 0, message.length, argv.port, argv.addr);
  }
};
// socket configuration
socket.on('error', (error) => {
  console.error(`socket error:\n${error.stack}`);
  socket.close();
});
socket.on('message', (message, rinfo) => {
  const data = message.toString();
  console.log(`receiving ${data} from ${rinfo.address}:${rinfo.port}`);
});
socket.on('listening', () => {
  const address = socket.address();
  console.log(`listening at ${address.address}:${address.port}`);
  // puncher configuration
  const puncher = new UdpHolePuncher(socket);
  puncher.on('connected', () => {
    console.log(`woohoo, we can talk to ${argv.addr}:${argv.port}`);
    sendData();
  });
  puncher.on('error', (error) => {
    console.log(`woops, something went wrong: ${error}`);
  });
  puncher.connect(argv.addr, argv.port);
});

// bind socket
socket.bind(argv.bind);
