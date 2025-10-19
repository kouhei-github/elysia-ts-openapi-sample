import { Elysia } from "elysia";
import openapi from "@elysiajs/openapi";
import { userRouter } from "./api/public/users/router";

const app = new Elysia()
  .use(openapi())
  .get("/", () => "Hello Elysia")
  .use(userRouter)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);