const { Transform } = require('stream');

function convertBufferTo1Channel(buffer) {
  const convertedBuffer = Buffer.alloc(buffer.length / 2);

  for (let i = 0; i < convertedBuffer.length / 2; i += 1) {
    const uint16 = buffer.readUInt16LE(i * 4);
    convertedBuffer.writeUInt16LE(uint16, i * 2);
  }

  return convertedBuffer;
}

class ConvertTo1ChannelStream extends Transform {
  constructor(source, options) {
    super(options);
  }

  // eslint-disable-next-line no-underscore-dangle,class-methods-use-this
  _transform(data, encoding, next) {
    next(null, convertBufferTo1Channel(data));
  }
}

module.exports = ConvertTo1ChannelStream;
