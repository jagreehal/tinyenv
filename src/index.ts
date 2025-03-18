import type { StandardSchemaV1 } from '@standard-schema/spec';

// Type definitions
type ArrayType = 'string' | 'number' | 'boolean';

type ValidatorFn<Keys extends readonly string[], Defaults> = <
  Key extends Keys[number],
>(
  key: Key,
  value: Key extends keyof Defaults ? Defaults[Key] : string,
) => void;

type Options<
  Keys extends readonly string[],
  Defaults extends Record<string, unknown>,
> = {
  defaults?: Defaults;
  validator?: ValidatorFn<Keys, Defaults>;
  delimiter?: string;
  arrayTypes?: Partial<Record<Keys[number], ArrayType>>;
};

export class TinyEnvSchema<
  Keys extends readonly string[],
  Defaults extends Partial<Record<Keys[number], unknown>> = Record<
    never,
    never
  >,
> implements
    StandardSchemaV1<
      unknown,
      {
        [Key in Keys[number]]: Key extends keyof Defaults
          ? Defaults[Key]
          : string;
      }
    >
{
  readonly '~standard': StandardSchemaV1.Props<
    unknown,
    {
      [Key in Keys[number]]: Key extends keyof Defaults
        ? Defaults[Key]
        : string;
    }
  > = {
    version: 1,
    vendor: 'tinyenv',
    validate: (value: unknown) => {
      try {
        const result = this.parseAndValidate(value);
        return { value: result };
      } catch (error) {
        return {
          issues: [
            {
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        };
      }
    },
    types: {
      input: {} as unknown,
      output: {} as {
        [Key in Keys[number]]: Key extends keyof Defaults
          ? Defaults[Key]
          : string;
      },
    },
  };

  constructor(
    private readonly keys: readonly [...Keys],
    private readonly options?: Options<Keys, Defaults>,
  ) {}

  private parseAndValidate(value: unknown): {
    [Key in Keys[number]]: Key extends keyof Defaults ? Defaults[Key] : string;
  } {
    // Ensure value is a Record<string, unknown>
    if (typeof value !== 'object' || value === null) {
      throw new Error('Input must be an object');
    }

    const env = {} as {
      [Key in Keys[number]]: Key extends keyof Defaults
        ? Defaults[Key]
        : string;
    };
    const delimiter = this.options?.delimiter ?? ',';
    const envVars = value as Record<string, unknown>;

    for (const key of this.keys) {
      const rawValue = envVars[key];
      const isEmpty = typeof rawValue === 'string' && rawValue.trim() === '';
      const defaultValue = this.options?.defaults?.[key];
      const arrayType = this.options?.arrayTypes?.[key];

      // Check for undefined defaults first
      if (defaultValue === undefined && key in (this.options?.defaults ?? {})) {
        throw new Error(
          `Invalid default value for key ${key}: undefined is not allowed`,
        );
      }

      // If neither a non-empty env var nor a default exists, throw an error
      if ((rawValue === undefined || isEmpty) && defaultValue === undefined) {
        throw new Error(`Missing environment variable: ${key}`);
      }

      // Use the raw value if it's not empty; otherwise, fall back to the default
      const value = isEmpty || rawValue === undefined ? defaultValue : rawValue;
      let parsedValue: unknown;

      if (defaultValue === undefined) {
        // Without a default, simply use the string value
        parsedValue = String(value);
      } else {
        const defaultType = typeof defaultValue;
        switch (defaultType) {
          case 'number': {
            const num = Number(value);
            if (Number.isNaN(num)) {
              throw new TypeError(`Failed to parse ${key} as number: ${value}`);
            }
            parsedValue = num;
            break;
          }
          case 'boolean': {
            const str = String(value).toLowerCase();
            if (['true', '1', 'yes'].includes(str)) {
              parsedValue = true;
            } else if (['false', '0', 'no'].includes(str)) {
              parsedValue = false;
            } else {
              throw new Error(`Failed to parse ${key} as boolean: ${value}`);
            }
            break;
          }
          case 'object': {
            // Handle arrays specifically
            if (Array.isArray(defaultValue)) {
              const elements = String(value)
                .split(delimiter)
                .map((el) => el.trim())
                .filter((el) => el !== '');

              if (arrayType) {
                // Use explicitly specified array type
                parsedValue = elements.map((el) =>
                  convertToType(el, arrayType, key),
                );
              } else if (defaultValue.length > 0) {
                // Infer type from default array element
                const elementType = typeof defaultValue[0];
                parsedValue = elements.map((el) =>
                  convertToType(el, elementType as ArrayType, key),
                );
              } else {
                // Default to string[] for empty arrays
                parsedValue = elements;
              }
            } else {
              // For other objects, attempt JSON parsing
              try {
                const parsed = JSON.parse(String(value));
                // Validate parsed object matches default shape
                validateObjectShape(parsed, defaultValue, key);
                parsedValue = parsed;
              } catch (error) {
                throw new Error(
                  `Failed to parse ${key} as JSON: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
            break;
          }
          default: {
            parsedValue = String(value);
          }
        }
      }

      // Run the optional validator
      if (this.options?.validator) {
        try {
          this.options.validator(key, parsedValue as (typeof env)[typeof key]);
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error(`Validation failed for ${key}: ${error}`);
        }
      }
      env[key] = parsedValue as (typeof env)[typeof key];
    }

    return Object.freeze(env);
  }
}

// Helper function to convert a string to a specific type
function convertToType(
  value: string,
  type: string | ArrayType,
  key: string,
): unknown {
  switch (type) {
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) {
        throw new TypeError(
          `Failed to parse ${key} array element as number: ${value}`,
        );
      }
      return num;
    }
    case 'boolean': {
      const str = value.toLowerCase();
      if (['true', '1', 'yes'].includes(str)) {
        return true;
      } else if (['false', '0', 'no'].includes(str)) {
        return false;
      }
      throw new Error(
        `Failed to parse ${key} array element as boolean: ${value}`,
      );
    }
    default: {
      return value;
    }
  }
}

// Helper function to validate object shape matches default
function validateObjectShape(
  value: unknown,
  defaultValue: unknown,
  key: string,
  path: string[] = [],
): void {
  if (typeof value !== typeof defaultValue) {
    throw new TypeError(
      `Invalid type for ${key}${path.length > 0 ? '.' + path.join('.') : ''}: expected ${typeof defaultValue}, got ${typeof value}`,
    );
  }

  if (typeof value === 'object' && value !== null) {
    const valueObj = value as Record<string, unknown>;
    const defaultObj = defaultValue as Record<string, unknown>;

    // Check all required properties exist
    for (const prop in defaultObj) {
      if (!(prop in valueObj) && defaultObj[prop] !== undefined) {
        throw new Error(
          `Missing required property ${key}${path.length > 0 ? '.' + path.join('.') : ''}.${prop}`,
        );
      }
      if (prop in valueObj) {
        validateObjectShape(valueObj[prop], defaultObj[prop], key, [
          ...path,
          prop,
        ]);
      }
    }
  }
}

// Main function that creates a TinyEnvSchema instance and validates process.env
export default function tinyenv<
  Keys extends readonly string[],
  Defaults extends Partial<Record<Keys[number], unknown>> = Record<
    never,
    never
  >,
>(
  keys: readonly [...Keys],
  options?: Options<Keys, Defaults>,
): Readonly<{
  [Key in Keys[number]]: Key extends keyof Defaults ? Defaults[Key] : string;
}> {
  const schema = new TinyEnvSchema(keys, options);
  const result = schema['~standard'].validate(process.env);
  if (result instanceof Promise) {
    throw new TypeError('Async validation is not supported');
  }
  if ('issues' in result && result.issues) {
    throw new Error(result.issues[0]?.message ?? 'Validation failed');
  }

  return result.value;
}
