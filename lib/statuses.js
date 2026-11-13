import { getItem, hgetall } from './store.js';

export const СТАТУСИ = 'lead-status:h';
const СТАТУСИ_СТАРІ = 'lead-status';
export async function усіСтатуси() {
  const [старі, нові] = await Promise.all([
    getItem(СТАТУСИ_СТАРІ).then(x => x || {}).catch(() => ({})),
    hgetall(СТАТУСИ).catch(() => ({}))
  ]);
  return { ...старі, ...нові };
}
