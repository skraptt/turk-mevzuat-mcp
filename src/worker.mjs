// Cloudflare Workers girişi. Veri ve dizin açılışta (global kapsamda) yüklenir,
// böylece istekler yalnızca arama maliyetini öder.

import data from '../data/mevzuat.json';
import { createEngine } from './engine.mjs';
import { handleRequest } from './server.mjs';

const engine = createEngine(data);

export default {
  fetch(request) {
    return handleRequest(engine, request);
  },
};
