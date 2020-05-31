require('dotenv').config();

const GoogleSpeech = require('@google-cloud/speech');
const GoogleTextToSpeech = require('@google-cloud/text-to-speech');
const Discord = require('discord.js');
const fs = require('fs');
const ytdl = require('ytdl-core');
const ytsearch = require('yt-search');
const ConvertTo1ChannelStream = require('./classes/ConvertTo1ChannelStream');
const Silence = require('./classes/Silence');

const discordClient = new Discord.Client();
const googleSpeechClient = new GoogleSpeech.SpeechClient();
const googleTextToSpeechClient = new GoogleTextToSpeech.TextToSpeechClient();

const queue = [];

let connection;
let dispatcher;

const play = () => {
  dispatcher = connection.play(ytdl(queue[0].url, { filter: 'audioonly', highWaterMark: 1<<25 }));

  dispatcher.on('finish', () => {
    if (queue.length > 0) play();
    else { dispatcher = null };
  });

  discordClient.user.setPresence({ activity: { name: queue[0].title, type: 'PLAYING' } });

  queue.shift();
};

const search = (query) => ytsearch(query, (searchError, result) => {
  if (searchError) console.error('error:', searchError);
  else if (result.videos && result.videos[0]) {
    queue.push({ title: result.videos[0].title, url: result.videos[0].url });
    if (!dispatcher) {
      googleTextToSpeechClient.synthesizeSpeech({
        input: { text: `ok, playing ${result.videos[0].title}` },
        voice: { languageCode: 'en-AU' },
        audioConfig: { audioEncoding: 'MP3' },
      })
        .then((response) => {
          fs.writeFile('output.mp3', response[0].audioContent, 'binary', (writeError) => {
            if (writeError) console.error('error:', writeError);
            else {
              const textToSpeechDispatch = connection.play(`file:///${__dirname}/output.mp3`);
              textToSpeechDispatch.on('finish', () => {
                play();
              });
            }
          });
        })
		.then((error) => console.error('error:', error));
    }
  }
});

const skip = () => { if (dispatcher) dispatcher.end(); };

discordClient.login(process.env.DISCORD_TOKEN);

discordClient
  .on('ready', () => console.log('Bot online'))
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
              .on('error', (error) => console.error('error:', error))
              .on('data', (response) => {
                const transcription = response.results
                  .map((result) => result.alternatives[0].transcript)
                  .join('\n')
                  .toLowerCase();
                console.log(user.username, transcription);

                if (transcription.includes('ok discord')) {
                  if (transcription.includes('play')) {
                    const [, query] = transcription.split('play');
                    search(query);
                  } else if (transcription.includes('skip')) skip();
                  else if (transcription.includes('pause')) {
                    if (dispatcher) dispatcher.pause();
                  } else if (transcription.includes('resume')) {
                    if (dispatcher) dispatcher.resume();
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

      case '/skip':
        skip();
        break;

      case '/queue':
        let queueMessage = ' ';
        if (queue.length < 1) queueMessage = 'No songs have been queued';
        else for (const song of queue) queueMessage += `\n${song.title} | ${song.url}`;
        message.channel.send(queueMessage);
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
