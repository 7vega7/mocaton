interface Env {
  MINI_APP_URL: string;
  BOT_USERNAME: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  return Response.json({
    MINI_APP_URL: context.env.MINI_APP_URL,
    BOT_USERNAME: context.env.BOT_USERNAME,
  });
}
