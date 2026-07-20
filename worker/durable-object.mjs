import { DurableObject } from "cloudflare:workers";

import { RoomState as RoomStateHandler } from "./room-state.mjs";

export class RoomState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.handler = new RoomStateHandler(ctx, env);
  }

  fetch(request) {
    return this.handler.fetch(request);
  }

  alarm() {
    return this.handler.alarm();
  }
}
