if (process.env.NODE_ENV !== 'production') {
  console.error('PRODUCTION_NODE_ENV_REQUIRED');
  process.exit(1);
}

require('../dist/src/main.js');
