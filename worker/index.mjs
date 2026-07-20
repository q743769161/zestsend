import handler from "../.open-next/worker.js";

export { RoomState } from "./durable-object.mjs";

export default {
  fetch: handler.fetch,
};
