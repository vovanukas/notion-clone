import { httpRouter } from "convex/server";
import { callbackPageDeployed } from "./httpActions";

const http = httpRouter();

http.route({
  path: "/callbackPageDeployed",
  method: "POST",
  handler: callbackPageDeployed,
});

export default http;