import assert from 'node:assert/strict';
import {jump} from '../engine.mjs';
// Required floor transitions have their own ±40ms matrix in required-routes.
// General seeded/pair regression follows their authored route, not a fake
// ground-only obstacle oracle. It still advances the exact production engine.
export function driveRequired(game,inputs) {
 for(const chunk of game.course.chunks)if(chunk.requiredRoute)for(const [i,input] of chunk.routeInputs.entries()){
  const key=`route:${chunk.index}:${i}`;
  if(game.elapsed>=input.at-1e-9&&!inputs.has(key)){
   assert(jump(game),`${chunk.id}: rejected route input ${i} at ${game.elapsed}`);inputs.set(key,true);
  }
 }
}
