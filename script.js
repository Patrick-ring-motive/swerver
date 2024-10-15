function isNullish(value) {
  return value === null || value === undefined;
}

class WorkerResponse extends Response {
  constructor(body, options = {}) {
    const { headers, ...rest } = options;

    // Convert headers to a Map (using headers.entries() if available, otherwise Object.entries)
    const headersMap = new Map(headers?.entries?.() ?? Object.entries(headers ?? {}));

    // Call the parent Response constructor, omitting headers for now
    super(body, { ...rest, headers: undefined });

    // Override the headers property with the Map
    Object.defineProperty(this, 'headers', {
      value: headersMap,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Copy other options properties to the instance if they are not already set
    for (const key in rest) {
      if (isNullish(this[key]) && !isNullish(rest[key])) {
        this[key] = rest[key];
      }
    }
  }
}

class WorkerRequest extends Request {
  constructor(input, options = {}) {
    if(input instanceof Request){
      options = Object.assign(input, options);
    }
    const { headers, ...rest } = options;

    const headersMap = new Map(headers?.entries?.() ?? Object.entries(headers ?? {}));

    super(input, { ...rest, headers: undefined });

    Object.defineProperty(this, 'headers', {
      value: headersMap,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    for (const key in rest) {
      if (isNullish(this[key]) && !isNullish(rest[key])) {
        this[key] = rest[key];
      }
    }
  }
}