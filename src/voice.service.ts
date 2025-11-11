// src/voice.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class VoiceService {
  private apiKey = process.env.ELEVENLABS_API_KEY!;
  private voiceId = process.env.ELEVENLABS_VOICE_ID!;

  async ttsToBuffer(text: string): Promise<Buffer> {
    if (!this.apiKey || !this.voiceId) {
      throw new Error('Falta ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID en .env');
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    const resp = await axios.post(
      url,
      {
        text,
        voice_settings: { stability: 0.45, similarity_boost: 0.8 },
      },
      {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg', // devuelve MP3
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    return Buffer.from(resp.data);
  }
}