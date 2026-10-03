import 'dotenv/config';
import { assertSafeTestDatabase } from './test-database.helper';

process.env.NODE_ENV = 'test';
assertSafeTestDatabase();
