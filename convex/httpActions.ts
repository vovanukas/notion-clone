import { httpAction } from "./_generated/server";
import { api } from './_generated/api';

export const callbackPageDeployed = httpAction(async (ctx, request) => {
    const { repository, data } = await request.json();
    const id = repository.split('/')[1]

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        throw new Error("Authorization header is missing");
    }
    const token = authHeader.split(' ')[1];

    let pagesUrl;
    if (data.buildStatus === "BUILT") {
        pagesUrl = await ctx.runAction(api.github.getPagesUrl, {
        id: id
        });
    }

    await ctx.runMutation(api.documents.updateBuildStatus, {
        id: id,
        buildStatus: data.buildStatus,
        websiteUrl: pagesUrl ?? undefined,
        callbackUserId: token,
    })

    await ctx.runMutation(api.documents.updatePublishStatus, {
        id: id,
        publishStatus: data.publishStatus,
        callbackUserId: token,
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }); 