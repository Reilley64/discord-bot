require('dotenv').config();

const GoogleSpeech = require('@google-cloud/speech');
const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const ytsearch = require('yt-search');
const ConvertTo1ChannelStream = require('./classes/ConvertTo1ChannelStream');
const Silence = require('./classes/Silence');

const discordClient = new Discord.Client();
const googleSpeechClient = new GoogleSpeech.SpeechClient();

const queue = [];

let connection;
let dispatcher;

const play = () => {
  dispatcher = connection.play(ytdl(queue[0].url, { filter: 'audioonly' }));

  dispatcher.on('finish', () => {
    if (queue.length > 0) play();
    else dispatcher = null;
  });

  discordClient.user.setPresence({ activity: { name: queue[0].title, type: 'PLAYING' } });

  queue.shift();
};

discordClient.login(process.env.DISCORD_TOKEN);

discordClient
  .on('ready', () => console.log('Bot ready'))
  .on('message', async (message) => {
    switch (message.content) {
      case '/join':
        if (message.member.voice.channel) {
          connection = await message.member.voice.channel.join();
          console.log('Connected', connection.channel.name);

          connection.play(new Silence(), { type: 'opus' });

          connection.on('speaking', (user) => {
            const audioStream = connection.receiver.createStream(user, { mode: 'pcm' });
            const recognizeStream = googleSpeechClient
              .streamingRecognize({
                config: { encoding: 'LINEAR16', sampleRateHertz: 48000, languageCode: 'en-AU' },
              })
              .on('error', console.error)
              .on('data', (response) => {
                const transcription = response.results
                  .map((result) => result.alternatives[0].transcript)
                  .join('\n')
                  .toLowerCase();
                console.log(user.username, transcription);

                if (transcription.includes('ok discord')) {
                  if (transcription.includes('play')) {
                    const [, search] = transcription.split('play');
                    ytsearch(search, (error, result) => {
                      if (error) console.error(error);
                      else if (result.videos && result.videos[0]) {
                        queue.push({ title: result.videos[0].title, url: result.videos[0].url });
                        if (!dispatcher) play();
                      }
                    });
                  } else if (transcription.includes('skip')) {
                    if (dispatcher) dispatcher.end();
                  }
                }
              });

            const convertTo1ChannelStream = new ConvertTo1ChannelStream();
            audioStream.pipe(convertTo1ChannelStream).pipe(recognizeStream);
          });
        }
        break;

      case '/leave':
        message.member.voice.channel.leave();
        break;

      case '/queue':
        let queueMessage = '';
        if (queue.length < 1) queueMessage = 'No songs have been queued';
        else for (const song of queue) queueMessage += `\n${song.title} | ${song.url}`;
        message.channel.send(queueMessage);
        break;

      default:
        break;
    }
  });
