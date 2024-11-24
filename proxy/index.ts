// dont run with `deno run --allow-net index.ts`, this file relies on retry.sh to catch the many Deno.exit(1)s
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { AtpAgent } from "https://esm.sh/@atproto/api@0.13.17";

const HOST = "bsky.social";
const USERNAME = "telescopefeeds.bsky.social";
const PASSWORD = "INSERT-APP-PASSWORD-HERE";
const ENDPOINT = "telescope.whey.party";
const DIDWEB = "did:web:" + ENDPOINT;

const agent = new AtpAgent({
  service: "https://" + HOST,
});
try {
  await agent.login({
    identifier: USERNAME,
    password: PASSWORD,
  });
} catch (e) {
  console.log(e);
  // assume agent is expired, exit to retry.sh
  Deno.exit(1);
}

serve(async (request: Request) => {
  const url = new URL(request.url);

  if (url.pathname === "/") {
    return Response.redirect("https://bsky.app/profile/" + USERNAME);
  }

  if (url.pathname === "/.well-known/did.json") {
    return new Response(
      JSON.stringify({
        "@context": ["https://www.w3.org/ns/did/v1"],
        id: DIDWEB,
        service: [
          {
            id: "#bsky_fg",
            type: "BskyFeedGenerator",
            serviceEndpoint: "https://" + ENDPOINT,
          },
        ],
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (url.pathname === "/xrpc/app.bsky.feed.getFeedSkeleton") {
    const feedParam = url.searchParams.get("feed");
    const cursorParam = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");

    // console.log(`feedParam: ${feedParam}, cursorParam: ${cursorParam}, limitParam: ${limitParam}`)

    if (feedParam && feedParam.startsWith("at://")) {
      try {
        const rkey = feedParam.split("/").pop();
        const repotouse = feedParam.split("/")[2];
        let searchQuerydata;

        try {
          const res = await agent.com.atproto.repo.getRecord({
            repo: repotouse,
            collection: "app.bsky.feed.generator",
            rkey: rkey || "bleh",
          });
          const value = res.data.value as {
            telescopeData: { searchQuery: string | Array<{ query: string }> };
            members: string | string[];
          };
          searchQuerydata = value.telescopeData.searchQuery;
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid telescopeData.searchQuery" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (typeof searchQuerydata === "string") {
          let res;
          try {
            res = await agent.app.bsky.feed.searchPosts({
              q: searchQuerydata || rkey || "bleh",
              limit: limitParam ? parseInt(limitParam) : 100,
              cursor: cursorParam || undefined,
            });
          } catch (err) {
            // assume agent is expired, exit to retry.sh
            console.log(err);
            Deno.exit(1);
          }

          return new Response(
            JSON.stringify({
              feedname: rkey,
              cursor: res.data.cursor || undefined,
              feed: res.data.posts.map((post) => ({ post: post.uri })),
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        } else if (Array.isArray(searchQuerydata)) {
          let feed: { post: string }[] = [];

          const length = searchQuerydata.length;
          const limitn = parseInt(limitParam || "100") || 100;
          const cursorn = parseInt(cursorParam || "0");

          for (let i = 0; i < searchQuerydata.length; i++) {
            try {
              const res = await agent.app.bsky.feed.searchPosts({
                q: searchQuerydata[i].query || rkey || "bleh",
                limit: limitParam ? (limitn > 100 ? 100 : limitn) : 100,
                cursor: parseInt((cursorn / length).toString()).toString(),
              });
              feed = feed.concat(
                res.data.posts.map((post) => ({ post: post.uri }))
              );
            } catch (err) {
              // assume agent is expired, exit to retry.sh
              console.log(err);
              Deno.exit(1);
            }
          }

          // rkey(tid) based sort
          const base32nums = "234567abcdefghijklmnopqrstuvwxyz";
          feed.sort((b, a) => {
            const akey = a.post.split("/").pop();
            const bkey = b.post.split("/").pop();
            if (!akey || !bkey) {
              return 0;
            }
            const decode = (str: string) =>
              str
                .split("")
                .reduce((acc, char) => acc * 32 + base32nums.indexOf(char), 0);
            return decode(akey) - decode(bkey);
          });

          // stateless/cacheless pagination
          const modFeed: { post: string }[] = [];
          for (
            let i = (cursorn % length) * limitn;
            i < ((cursorn % length) + 1) * limitn;
            i++
          ) {
            modFeed.push(feed[i]);
          }

          return new Response(
            JSON.stringify({
              feedname: rkey,
              cursor: (cursorn + 1).toString(),
              feed: modFeed,
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
      } catch (err) {
        console.log(err);
        return new Response(
          JSON.stringify({
            error: "Invalid feed parameter format (try catch err)",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } else {
      return new Response("Invalid feed parameter", { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
});
