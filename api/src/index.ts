import { buildApp } from "./app.js";

const app = await buildApp();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exit(1);
    });
  });
}

try {
  await app.listen({ port: app.config.PORT, host: app.config.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
