# 🎁 tinyenv

**tinyenv** is a lightweight, type-safe utility for managing environment variables in Node.js applications.

It simplifies the process of defining, validating and parsing environment variables with automatic type inference and validation.

## Quick Start

```typescript
import tinyenv from 'tinyenv';

// Basic usage - all variables are strings by default
const env = tinyenv(['PORT', 'NODE_ENV']);
env.PORT; // string (process.env.PORT)
env.NODE_ENV; // string (process.env.NODE_ENV)

// Add defaults for optional variables and type inference
const env = tinyenv(['PORT', 'DEBUG', 'APP_NAME'], {
  defaults: {
    PORT: 3000, // inferred as number
    DEBUG: false, // inferred as boolean
    APP_NAME: 'app', // inferred as string
  },
});
```

## Installation

```bash
npm install tinyenv
yarn add tinyenv
pnpm add tinyenv
bun add tinyenv
```

## Type Conversion

### Numbers

```typescript
// Automatic number conversion based on default type
process.env.PORT = '3000';
const env = tinyenv(['PORT'], {
  defaults: { PORT: 8080 }, // number type inferred from default
});
env.PORT; // 3000 (number)

// Without defaults, values remain as strings
const env = tinyenv(['PORT']);
env.PORT; // '3000' (string)

// Supports decimals
process.env.RATIO = '3.14';
const env = tinyenv(['RATIO'], {
  defaults: { RATIO: 1.0 },
});
env.RATIO; // 3.14 (number)
```

### Booleans

```typescript
// Boolean parsing with type inference
process.env.DEBUG = 'true'; // or '1' or 'yes'
const env = tinyenv(['DEBUG'], {
  defaults: { DEBUG: false },
});
env.DEBUG; // true (boolean)

// Supported values
const truthyValues = ['true', '1', 'yes', 'TRUE', 'YES'];
const falsyValues = ['false', '0', 'no', 'FALSE', 'NO'];
```

### Arrays

```typescript
// String arrays (default)
process.env.HOSTS = 'localhost,127.0.0.1';
const env = tinyenv(['HOSTS'], {
  defaults: { HOSTS: [] as string[] },
});
env.HOSTS; // ['localhost', '127.0.0.1']

// Number arrays with type inference from default
process.env.PORTS = '3000,4000,5000';
const env = tinyenv(['PORTS'], {
  defaults: { PORTS: [8080] }, // Type inferred from default
});
env.PORTS; // [3000, 4000, 5000] (number[])

// Custom delimiter for all array parsing
const env = tinyenv(['LIST'], {
  defaults: { LIST: [] as string[] },
  delimiter: ';',
});

// Explicit array types for empty arrays
const env = tinyenv(['NUMS', 'FLAGS'], {
  defaults: {
    NUMS: [], // Empty array
    FLAGS: [], // Empty array
  },
  arrayTypes: {
    NUMS: 'number',
    FLAGS: 'boolean',
  },
});
```

### Objects

```typescript
// Type-safe object parsing with validation
type DBConfig = {
  db: {
    host: string;
    port: number;
  };
};

// Objects are validated against the default structure
process.env.CONFIG = '{"db":{"host":"localhost","port":5432}}';
const env = tinyenv(['CONFIG'], {
  defaults: {
    CONFIG: { db: { host: '', port: 0 } } as DBConfig,
  },
});

// Missing or invalid properties throw errors
process.env.CONFIG = '{"db":{"host":"localhost"}}';
// Error: Missing required property CONFIG.db.port

process.env.CONFIG = '{"db":{"host":"localhost","port":"5432"}}';
// Error: Invalid type for CONFIG.db.port: expected number, got string
```

## Validation

### Custom Validation

```typescript
const env = tinyenv(['PORT', 'NODE_ENV'], {
  defaults: {
    PORT: 8080,
    NODE_ENV: 'development',
  },
  validator: (key, value) => {
    switch (key) {
      case 'PORT': {
        if (typeof value === 'number' && (value < 1024 || value > 65535)) {
          throw new Error('Port must be between 1024 and 65535');
        }
        break;
      }
      case 'NODE_ENV': {
        if (!['development', 'production', 'test'].includes(value as string)) {
          throw new Error('Invalid NODE_ENV value');
        }
        break;
      }
    }
  },
});
```

## Standard Schema Support

TinyEnv implements the [Standard Schema](https://github.com/standard-schema/standard-schema) interface, making it compatible with any tool that accepts Standard Schema validators.

```typescript
import { TinyEnvSchema } from 'tinyenv';

// Create a schema instance
const schema = new TinyEnvSchema(['PORT', 'NODE_ENV'], {
  defaults: {
    PORT: 3000,
    NODE_ENV: 'development',
  },
});

// Use with any Standard Schema compatible tool
const result = schema['~standard'].validate({
  PORT: '8080',
  NODE_ENV: 'production',
});

if ('issues' in result) {
  console.error('Validation failed:', result.issues);
} else {
  console.log('Validated value:', result.value);
}
```

## Error Handling

```typescript
// Missing required variables
tinyenv(['REQUIRED_VAR']);
// Error: Missing environment variable: REQUIRED_VAR

// Invalid type conversion
process.env.PORT = 'not-a-number';
tinyenv(['PORT'], { defaults: { PORT: 3000 } });
// Error: Failed to parse PORT as number: not-a-number

// Invalid object shape (missing property)
process.env.CONFIG = '{"db":{"host":"localhost"}}';
tinyenv(['CONFIG'], {
  defaults: { CONFIG: { db: { host: '', port: 0 } } },
});
// Error: Missing required property CONFIG.db.port

// Invalid object shape (wrong type)
process.env.CONFIG = '{"db":{"host":123,"port":5432}}';
// Error: Invalid type for CONFIG.db.host: expected string, got number

// Invalid JSON
process.env.CONFIG = 'invalid-json';
tinyenv(['CONFIG'], { defaults: { CONFIG: {} } });
// Error: Failed to parse CONFIG as JSON: Unexpected token 'i', "invalid-json" is not valid JSON
```

## Important Behaviours

- Variables without defaults are always strings
- Empty strings (`""`) and whitespace-only strings are treated as undefined
- Arrays are automatically trimmed and filtered for empty elements
- Objects are deeply validated against the default structure for type safety
- JSON parsing is validated against defaults to prevent security issues
- Return value is frozen (immutable)
- Case-sensitive environment variable names
- Undefined is not allowed as a default value
- All environment variables are converted to strings before processing

## API

### `tinyenv(keys, options?)`

#### Parameters

- `keys`: Array of environment variable names
- `options`: Optional configuration object
  - `defaults`: Object with default values that also define types
  - `validator`: Function to validate values `(key, value) => void`
  - `delimiter`: String to split array values (defaults to ',')
  - `arrayTypes`: Specify types for empty arrays `{ key: 'string' | 'number' | 'boolean' }`

#### Returns

A frozen object containing the environment variables with inferred types.

### `TinyEnvSchema`

A class that implements the Standard Schema interface. Use this if you need to integrate with tools that accept Standard Schema validators.

#### Constructor Parameters

Same as `tinyenv` function.

#### Methods

- `~standard.validate(value: unknown)`: Validates an object against the schema
- `~standard.types`: Type information for TypeScript integration

## Contributing

We welcome contributions! Please open an issue or submit a pull request on GitHub.

## Licence

tinyenv is licensed under the MIT Licence. See [LICENCE](LICENCE) for details.
