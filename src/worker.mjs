// Cloudflare Workers girişi. Veri ve dizin açılışta (global kapsamda) yüklenir,
// böylece istekler yalnızca arama maliyetini öder.

import data from '../data/mevzuat.json';
import { createEngine } from './engine.mjs';
import { handleRequest } from './server.mjs';
import { createSemantic } from './semantic.mjs';

const engine = createEngine(data);

export default {
  fetch(request, env) {
    // Anlamsal arama bağları (AI, VEC) yoksa yalnızca sözcük araması yapılır.
    return handleRequest(engine, request, { semantic: createSemantic(env) });
  },
};
