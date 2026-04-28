import { SerialError, SerialErrorCode } from '@gurezo/web-serial-rxjs';
import {
  getConnectionErrorMessage,
  getReadErrorMessage,
  getWriteErrorMessage,
} from './serial-error-messages';

describe('serial-error-messages', () => {
  describe('getConnectionErrorMessage', () => {
    it('should return message for SerialError by code', () => {
      const error = new SerialError(
        SerialErrorCode.OPERATION_CANCELLED,
        'cancelled'
      );
      expect(getConnectionErrorMessage(error)).toBe(
        "Failed to execute 'requestPort' on 'Serial': No port selected by the user."
      );
    });

    it('should return message for DOMException (No port selected)', () => {
      const error = new DOMException('No port selected', 'NotFoundError');
      expect(getConnectionErrorMessage(error)).toBe(
        "Failed to execute 'requestPort' on 'Serial': No port selected by the user."
      );
    });

    it('should return message for DOMException (already open)', () => {
      const error = new DOMException('Port already open', 'InvalidStateError');
      expect(getConnectionErrorMessage(error)).toContain('already open');
    });

    it('should return message for Error', () => {
      expect(getConnectionErrorMessage(new Error('custom'))).toBe('custom');
    });

    it('should return Unknown error for unknown', () => {
      expect(getConnectionErrorMessage(undefined)).toBe('Unknown error');
      expect(getConnectionErrorMessage('string')).toBe('Unknown error');
    });
  });

  describe('getReadErrorMessage', () => {
    it('should return message for SerialError', () => {
      const error = new SerialError(
        SerialErrorCode.READ_FAILED,
        'read failed'
      );
      expect(getReadErrorMessage(error)).toBe(
        'Read error: Failed to read from serial port'
      );
    });

    it('should return message for Error', () => {
      expect(getReadErrorMessage(new Error('network'))).toBe(
        'Read error: network'
      );
    });

    it('should return Unknown read error for unknown', () => {
      expect(getReadErrorMessage(undefined)).toBe('Unknown read error');
    });
  });

  describe('getWriteErrorMessage', () => {
    it('should return message for SerialError', () => {
      const error = new SerialError(
        SerialErrorCode.WRITE_FAILED,
        'write failed'
      );
      expect(getWriteErrorMessage(error)).toBe(
        'Write error: Failed to write to serial port'
      );
    });

    it('should return message for Error', () => {
      expect(getWriteErrorMessage(new Error('busy'))).toBe(
        'Write error: busy'
      );
    });

    it('should return Unknown write error for unknown', () => {
      expect(getWriteErrorMessage(null)).toBe('Unknown write error');
    });
  });
});
