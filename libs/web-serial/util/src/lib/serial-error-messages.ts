import {
  SerialError,
  SerialErrorCode,
} from '@gurezo/web-serial-rxjs';

function getErrorMessageFromCode(code: SerialErrorCode): string {
  switch (code) {
    case SerialErrorCode.BROWSER_NOT_SUPPORTED:
      return 'このブラウザでは Web Serial API に対応していません。Chromium 系ブラウザをご利用ください。';
    case SerialErrorCode.INVALID_FILTER_OPTIONS:
      return 'シリアルポートのフィルタ指定が無効です。';
    case SerialErrorCode.OPERATION_TIMEOUT:
      return 'シリアル操作がタイムアウトしました。';
    case SerialErrorCode.UNKNOWN:
      return '不明なエラーが発生しました';
    case SerialErrorCode.OPERATION_CANCELLED:
      return "Failed to execute 'requestPort' on 'Serial': No port selected by the user.";
    case SerialErrorCode.PORT_ALREADY_OPEN:
      return "Failed to execute 'open' on 'SerialPort': The port is already open.";
    case SerialErrorCode.PORT_OPEN_FAILED:
      return '接続に失敗しました';
    case SerialErrorCode.PORT_NOT_AVAILABLE:
      return 'サポートされていないデバイスです。Raspberry Pi Zero以外のデバイスは接続できません。';
    case SerialErrorCode.READ_FAILED:
      return 'Read error: Failed to read from serial port';
    case SerialErrorCode.WRITE_FAILED:
      return 'Write error: Failed to write to serial port';
    case SerialErrorCode.CONNECTION_LOST:
      return '接続が切断されました';
    case SerialErrorCode.PORT_NOT_OPEN:
      return 'シリアルポートが開かれていません';
    default:
      return 'Unknown error';
  }
}

function parseDOMException(error: DOMException): string {
  const message = error.message;
  if (message.includes('No port selected')) {
    return "Failed to execute 'requestPort' on 'Serial': No port selected by the user.";
  }
  if (message.includes('already open')) {
    return "Failed to execute 'open' on 'SerialPort': The port is already open.";
  }
  if (message.includes('Failed to open')) {
    return "Failed to execute 'open' on 'SerialPort': Failed to open serial port.";
  }
  return message || 'Unknown error';
}

/**
 * 接続エラーを表示用メッセージに変換する（純粋関数）
 * @param error エラーオブジェクト
 * @returns 表示用エラーメッセージ
 */
export function getConnectionErrorMessage(error: unknown): string {
  if (error instanceof SerialError) {
    return getErrorMessageFromCode(error.code);
  }
  if (error instanceof DOMException) {
    return parseDOMException(error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

/**
 * 読み取りエラーを表示用メッセージに変換する（純粋関数）
 * @param error エラーオブジェクト
 * @returns 表示用エラーメッセージ
 */
export function getReadErrorMessage(error: unknown): string {
  if (error instanceof SerialError) {
    return getErrorMessageFromCode(error.code);
  }
  if (error instanceof Error) {
    return `Read error: ${error.message}`;
  }
  return 'Unknown read error';
}

/**
 * 書き込みエラーを表示用メッセージに変換する（純粋関数）
 * @param error エラーオブジェクト
 * @returns 表示用エラーメッセージ
 */
export function getWriteErrorMessage(error: unknown): string {
  if (error instanceof SerialError) {
    return getErrorMessageFromCode(error.code);
  }
  if (error instanceof Error) {
    return `Write error: ${error.message}`;
  }
  return 'Unknown write error';
}

/**
 * Raspberry Pi Zero 検証エラーメッセージを返す
 * @returns エラーメッセージ
 */
export function getRaspberryPiZeroError(): string {
  return 'Web Serial is not Raspberry Pi Zero';
}

