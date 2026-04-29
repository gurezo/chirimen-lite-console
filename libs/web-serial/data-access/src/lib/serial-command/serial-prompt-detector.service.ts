import { Injectable } from '@angular/core';

/**
 * シリアル受信バッファが shell / login / password など期待するプロンプトを含むか判定する。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialPromptDetectorService {
  matchesPrompt(input: string, prompt: string | RegExp): boolean {
    if (typeof prompt === 'string') {
      return input.includes(prompt);
    }
    prompt.lastIndex = 0;
    return prompt.test(input);
  }
}
