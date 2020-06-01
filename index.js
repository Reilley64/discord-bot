require('dotenv').config();

const GoogleTextToSpeech = require('@google-cloud/text-to-speech');
const Discord = require('discord.js');
const fs = require('fs');
const { google } = require('googleapis');
const ytdl = require('ytdl-core');
const Detector = require('./lib/native-voice-command-detector');
const Silence = require('./classes/Silence');

const discordClient = new Discord.Client();
const googleTextToSpeechClient = new GoogleTextToSpeech.TextToSpeechClient();
const youtube = google.youtube({ version: 'v3', auth: process.env.GOOGLE_API_KEY });

const queue = [];

let connection;
let messageChannel;
let dispatcher;

const play = () => {
  dispatcher = connection.play(ytdl(queue[0].url, { filter: 'audioonly', highWaterMark: 1 << 25 }));

  dispatcher.on('finish', () => {
    if (queue.length > 0) play();
    else { dispatcher = null; }
  });

  discordClient.user.setPresence({ activity: { name: queue[0].title, type: 'PLAYING' } });

  queue.shift();
};

const search = (query) => youtube.search.list({
  part: 'id, snippet',
  q: query,
})
  .then((searchResponse) => {
    if (searchResponse.data.items && searchResponse.data.items[0]) {
      queue.push({
        title: searchResponse.data.items[0].snippet.title,
        url: `https://www.youtube.com/watch?v=${searchResponse.data.items[0].id.videoId}`,
      });
      if (!dispatcher) {
        googleTextToSpeechClient.synthesizeSpeech({
          input: { text: `ok, playing ${queue[0].title}` },
          voice: { languageCode: 'en-AU' },
          audioConfig: { audioEncoding: 'MP3' },
        })
          .then((textResponse) => {
            fs.writeFile('output.mp3', textResponse[0].audioContent, 'binary', (writeError) => {
              if (writeError) console.error('error:', writeError);
              else {
                const textToSpeechDispatch = connection.play(`file:///${__dirname}/output.mp3`);
                textToSpeechDispatch.on('finish', () => {
                  play();
                });
              }
            });
          });
      } else {
        const botMessage = new Discord.MessageEmbed()
          .setColor('#cb4b16')
          .setDescription(`[${queue[0].title}](${queue[0].url}) added to queue`);
        messageChannel.send(botMessage);
      }
    }
  });

const skip = () => { if (dispatcher) dispatcher.end(); };

const detector = new Detector(
  './lib/native-voice-command-detector/deps/Porcupine/lib/common/porcupine_params.pv',
  './lib/native-voice-command-detector/deps/Porcupine/resources/keyword_files/linux/terminator_linux.ppn',
  0.5,
  process.env.GOOGLE_API_KEY,
  200,
  3000,
  1000,
  (id, command) => {
    console.log('command:', command);
    if (command.includes('play')) {
      const split = command.split('play');
      if (split[1]) search(split[1]);
    } else if (command.includes('skip')) skip();
    else if (command.includes('pause')) {
      if (dispatcher) dispatcher.pause();
    } else if (command.includes('resume')) {
      if (dispatcher) dispatcher.resume();
    }
  },
);

discordClient.login(process.env.DISCORD_TOKEN);

discordClient
  .on('ready', () => {
    messageChannel = discordClient.channels.cache.get('420569066827284481');
    console.log('Bot online');
  })
  .on('message', async (message) => {
    switch (message.content) {
      case '/join':
        if (message.member.voice.channel) {
          connection = await message.member.voice.channel.join();
          console.log('Connected', connection.channel.name);

          connection.play(new Silence(), { type: 'opus' });

          connection.on('speaking', (user) => {
            const audioStream = connection.receiver.createStream(user);
            audioStream.on('data', (buffer) => detector.addOpusFrame(user.id, buffer));
          });
        }
        break;

      case '/leave':
        message.member.voice.channel.leave();
        break;

      case '/skip':
        skip();
        break;

      case '/queue':
        let queueMessage = '';
        if (queue.length < 1) queueMessage += 'No songs have been queued';
        else for (const [i, song] of queue.entries()) queueMessage += `${i !== 0 ? '\n' : ''}[${song.title}](${song.url})`;
        const botMessage = new Discord.MessageEmbed()
          .setColor('#cb4b16')
          .setTitle('Queue')
          .setDescription(queueMessage);
        message.channel.send(botMessage);
        break;

      default:
        if (message.content.includes('/play')) {
          if (connection) {
            const split = message.content.split(' ');
            if (split[1]) {
              const query = split.filter((part, i) => i !== 0).join(' ');
              search(query);
            }
          }
        }

        break;
    }
  });
