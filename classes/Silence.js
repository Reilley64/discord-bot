const { Readable } = require('stream');

class Silence extends Readable {
  // eslint-disable-next-line no-underscore-dangle
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE]));
  }
}

module.exports = Silence;
