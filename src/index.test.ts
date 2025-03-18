import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import tinyenv from './index';

describe('tinyenv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Basic Functionality', () => {
    it('reads string environment variables', () => {
      process.env.APP_NAME = 'MyApp';
      const env = tinyenv(['APP_NAME']);
      expect(env.APP_NAME).toBe('MyApp');
      // TypeScript type assertion
      const _typeCheck: string = env.APP_NAME;
    });

    it('throws on missing required variables', () => {
      expect(() => tinyenv(['MISSING_VAR'])).toThrow(
        'Missing environment variable: MISSING_VAR',
      );
    });

    it('handles default values', () => {
      const env = tinyenv(['PORT'], {
        defaults: { PORT: 3000 },
      });
      expect(env.PORT).toBe(3000);
    });

    it('overrides defaults with environment values', () => {
      process.env.PORT = '8080';
      const env = tinyenv(['PORT'], {
        defaults: { PORT: 3000 },
      });
      expect(env.PORT).toBe(8080);
    });

    it('treats empty strings as undefined', () => {
      process.env.NAME = '';
      const env = tinyenv(['NAME'], {
        defaults: { NAME: 'default' },
      });
      expect(env.NAME).toBe('default');
    });

    it('treats whitespace-only strings as undefined', () => {
      process.env.NAME = '   ';
      const env = tinyenv(['NAME'], {
        defaults: { NAME: 'default' },
      });
      expect(env.NAME).toBe('default');
    });
  });

  describe('Type Conversion', () => {
    it('converts numbers', () => {
      process.env.COUNT = '42';
      const env = tinyenv(['COUNT'], {
        defaults: { COUNT: 0 },
      });
      expect(env.COUNT).toBe(42);
      expect(typeof env.COUNT).toBe('number');
    });

    it('converts decimal numbers', () => {
      process.env.RATIO = '3.14';
      const env = tinyenv(['RATIO'], {
        defaults: { RATIO: 1 },
      });
      expect(env.RATIO).toBe(3.14);
    });

    it('throws on invalid number conversion', () => {
      process.env.COUNT = 'not-a-number';
      expect(() =>
        tinyenv(['COUNT'], {
          defaults: { COUNT: 0 },
        }),
      ).toThrow('Failed to parse COUNT as number: not-a-number');
    });

    it('converts booleans with various truthy values', () => {
      const truthyValues = ['true', '1', 'yes', 'TRUE', 'YES'];
      for (const value of truthyValues) {
        process.env.FLAG = value;
        const env = tinyenv(['FLAG'], {
          defaults: { FLAG: false },
        });
        expect(env.FLAG).toBe(true);
      }
    });

    it('converts booleans with various falsy values', () => {
      const falsyValues = ['false', '0', 'no', 'FALSE', 'NO'];
      for (const value of falsyValues) {
        process.env.FLAG = value;
        const env = tinyenv(['FLAG'], {
          defaults: { FLAG: true },
        });
        expect(env.FLAG).toBe(false);
      }
    });

    it('throws on invalid boolean conversion', () => {
      process.env.FLAG = 'invalid';
      expect(() =>
        tinyenv(['FLAG'], {
          defaults: { FLAG: false },
        }),
      ).toThrow('Failed to parse FLAG as boolean: invalid');
    });
  });

  describe('Array Handling', () => {
    it('handles string arrays with default delimiter', () => {
      process.env.HOSTS = 'localhost,127.0.0.1,example.com';
      const env = tinyenv(['HOSTS'], {
        defaults: { HOSTS: [] as string[] },
      });
      expect(env.HOSTS).toEqual(['localhost', '127.0.0.1', 'example.com']);
    });

    it('handles number arrays with default delimiter', () => {
      process.env.PORTS = '3000,4000,5000';
      const env = tinyenv(['PORTS'], {
        defaults: { PORTS: [8080] },
      });
      expect(env.PORTS).toEqual([3000, 4000, 5000]);
    });

    it('handles arrays with custom delimiter', () => {
      process.env.LIST = 'a;b;c';
      const env = tinyenv(['LIST'], {
        defaults: { LIST: [] as string[] },
        delimiter: ';',
      });
      expect(env.LIST).toEqual(['a', 'b', 'c']);
    });

    it('handles empty arrays with type inference', () => {
      process.env.NUMS = '1,2,3';
      const env = tinyenv(['NUMS'], {
        defaults: { NUMS: [] },
        arrayTypes: { NUMS: 'number' },
      });
      expect(env.NUMS).toEqual([1, 2, 3]);
    });

    it('throws on invalid array element type', () => {
      process.env.NUMS = '1,not-a-number,3';
      expect(() =>
        tinyenv(['NUMS'], {
          defaults: { NUMS: [0] },
        }),
      ).toThrow('Failed to parse NUMS array element as number: not-a-number');
    });

    it('handles boolean arrays', () => {
      process.env.FLAGS = 'true,0,yes,false,1,no';
      const env = tinyenv(['FLAGS'], {
        defaults: { FLAGS: [] },
        arrayTypes: { FLAGS: 'boolean' },
      });
      expect(env.FLAGS).toEqual([true, false, true, false, true, false]);
    });

    it('trims whitespace from array elements', () => {
      process.env.LIST = ' a , b , c ';
      const env = tinyenv(['LIST'], {
        defaults: { LIST: [] as string[] },
      });
      expect(env.LIST).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Object Validation', () => {
    it('validates object shape', () => {
      type Config = {
        db: {
          host: string;
          port: number;
        };
      };

      process.env.CONFIG = '{"db":{"host":"localhost","port":5432}}';
      const env = tinyenv(['CONFIG'], {
        defaults: {
          CONFIG: { db: { host: '', port: 0 } } as Config,
        },
      });
      expect(env.CONFIG).toEqual({
        db: {
          host: 'localhost',
          port: 5432,
        },
      });
    });

    it('throws on missing required properties', () => {
      process.env.CONFIG = '{"db":{"host":"localhost"}}';
      expect(() =>
        tinyenv(['CONFIG'], {
          defaults: {
            CONFIG: { db: { host: '', port: 0 } },
          },
        }),
      ).toThrow('Missing required property CONFIG.db.port');
    });

    it('throws on invalid property types', () => {
      process.env.CONFIG = '{"db":{"host":"localhost","port":"5432"}}';
      expect(() =>
        tinyenv(['CONFIG'], {
          defaults: {
            CONFIG: { db: { host: '', port: 0 } },
          },
        }),
      ).toThrow('Invalid type for CONFIG.db.port: expected number, got string');
    });

    it('throws on invalid JSON', () => {
      process.env.CONFIG = 'invalid-json';
      expect(() =>
        tinyenv(['CONFIG'], {
          defaults: {
            CONFIG: {},
          },
        }),
      ).toThrow(/Failed to parse CONFIG as JSON:/);
    });
  });

  describe('Custom Validation', () => {
    it('supports custom validation', () => {
      process.env.PORT = '80';
      expect(() =>
        tinyenv(['PORT'], {
          defaults: { PORT: 8080 },
          validator: (key, value) => {
            if (
              key === 'PORT' &&
              typeof value === 'number' &&
              (value < 1024 || value > 65_535)
            ) {
              throw new Error('Port must be between 1024 and 65535');
            }
          },
        }),
      ).toThrow('Port must be between 1024 and 65535');
    });

    it('validates multiple fields', () => {
      process.env.NODE_ENV = 'staging';
      expect(() =>
        tinyenv(['NODE_ENV'], {
          defaults: { NODE_ENV: 'development' },
          validator: (key, value) => {
            if (
              key === 'NODE_ENV' &&
              !['development', 'production', 'test'].includes(value as string)
            ) {
              throw new Error('Invalid NODE_ENV value');
            }
          },
        }),
      ).toThrow('Invalid NODE_ENV value');
    });
  });

  describe('Edge Cases', () => {
    it('rejects undefined defaults', () => {
      expect(() =>
        tinyenv(['VAR'], {
          defaults: { VAR: undefined },
        }),
      ).toThrow('Invalid default value for key VAR: undefined is not allowed');
    });

    it('freezes the returned object', () => {
      const env = tinyenv(['NODE_ENV'], {
        defaults: { NODE_ENV: 'development' },
      });
      expect(Object.isFrozen(env)).toBe(true);
      expect(() => {
        (env as { NODE_ENV: string }).NODE_ENV = 'production';
      }).toThrow();
    });

    it('handles empty environment variables with defaults', () => {
      process.env.NAME = '';
      const env = tinyenv(['NAME'], {
        defaults: { NAME: 'default' },
      });
      expect(env.NAME).toBe('default');
    });
  });
});
