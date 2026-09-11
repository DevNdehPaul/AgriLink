import { httpServerHandler } from "cloudflare:node";

import { createApp } from "./app.js";
import { prismaMiddleware } from "./common/middleware/prisma.middleware.js";

const PORT = 3000;

const app = createApp({
  prismaMiddleware,
});

app.listen(PORT);

export default httpServerHandler({
  port: PORT,
});