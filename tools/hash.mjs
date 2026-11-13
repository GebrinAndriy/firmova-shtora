import { scrypt as _scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import readline from 'node:readline';

const scrypt = promisify(_scrypt);
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  rl._writeToOutput = () => rl.output.write('*');
  return new Promise(res => rl.question(q, a => { rl.output.write('\n'); rl.close(); res(a); }));
}

const pw = (process.argv[2] || await ask('Пароль: ')).trim();
if (pw.length < 8) {
  console.error('\nЗакороткий. Візьміть довгий випадковий пароль (12+ символів).');
  process.exit(1);
}
const salt = randomBytes(16);
const key = await scrypt(pw, salt, 32, SCRYPT);
console.log(`scrypt$${SCRYPT.N}$${salt.toString('hex')}$${key.toString('hex')}`);
