require('dotenv').config();

const GoogleSpeech = require('@google-cloud/speech');
const Discord = require('discord.js');
const ConvertTo1ChannelStream = require('./classes/ConvertTo1ChannelStream');
const Silence = require('./classes/Silence');

const discordClient = new Discord.Client();
const googleSpeechClient = new GoogleSpeech.SpeechClient();

discordClient.login(process.env.DISCORD_TOKEN);

discordClient
  .on('ready', () => console.log('Bot ready'))
  .on('message', async (message) => {
    switch (message.content) {
      case '/join':
        if (message.member.voice.channel) {
          const connection = await message.member.voice.channel.join();
          console.log('Connected to: ', connection.channel.name);

          connection.play(new Silence(), { type: 'opus' });

          connection.on('speaking', (user, state) => {
            console.log(`I'm listening to ${user.username}`);

            const audioStream = connection.receiver.createStream(user, { mode: 'pcm' });
            const recognizeStream = googleSpeechClient
              .streamingRecognize({
                config: { encoding: 'LINEAR16', sampleRateHertz: 48000, languageCode: 'en-US' },
              })
              .on('error', console.error)
              .on('data', (response) => {
                const transcription = response.results
                  .map((result) => result.alternatives[0].transcript)
                  .join('\n')
                  .toLowerCase();

                if (transcription.includes('okay discord')) {
                  if (transcription.includes('play')) {
                    const [, search] = transcription.split('play');
                  }
                }
              });

            const convertTo1ChannelStream = new ConvertTo1ChannelStream();
            audioStream.pipe(convertTo1ChannelStream).pipe(recognizeStream);
            audioStream.on('end', async () => console.log('audioStream end'));
          });
        }
        break;

      case '/leave':
        message.member.voice.channel.leave();
        break;

      default:
        break;
    }
  });
