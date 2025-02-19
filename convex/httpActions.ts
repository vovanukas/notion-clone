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

    if (typeof data.workflowRunning !== 'boolean') {
        throw new Error("Invalid or missing data: 'workflowRunning' must be a boolean");
    }

    const pagesUrl = await ctx.runAction(api.github.getPagesUrl, {
        id: id
    })

    await ctx.runMutation(api.documents.updatePagesBuildStatus, {
        id: id,
        workflowRunning: data.workflowRunning,
        websiteUrl: pagesUrl,
        callbackUserId: token,
    })

    return new Response(repository, {
      status: 200,
    });
  }); 