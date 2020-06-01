const toWav = require('audiobuffer-to-wav');
const { Transform } = require('stream');

function convertToWav(buffer) {
  return toWav(buffer, { numberOfChannels: 1, sampleRate: 16000 });
}

class ConvertToWav extends Transform {
  constructor(source, options) {
    super(options);
  }

  // eslint-disable-next-line no-underscore-dangle,class-methods-use-this
  _transform(data, encoding, next) {
    next(null, convertToWav(data));
  }
}

module.exports = ConvertToWav;
