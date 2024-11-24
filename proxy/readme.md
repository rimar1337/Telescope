# Bluesky Search Proxy

Bluesky Search Proxy relies on the below specific **app.bsky.feed.generator** record specification.

1. Set the `did` field to your host's DID or use the default instance (`did:web:telescope.whey.party`).
2. Inside the `telescopeData` object, specify the `searchQuery` parameter. This can be:
   - A **string** for a single query.
   - An **array of query objects**, each with a `query` field, to support multiple search terms.

## Example Feed Definition

Below is an example JSON configuration for a custom feed:

```json
{
  "did": "did:web:telescope.whey.party",
  "$type": "app.bsky.feed.generator",
  "avatar": {
    "$type": "blob",
    "ref": {
      "$link": "bafkreihluiw5htinvyyz743j2wd5vlwd5qmyxsknl3gnmwh6jinifkiree"
    },
    "mimeType": "image/png",
    "size": 194783
  },
  "createdAt": "2024-11-23T08:29:04.201Z",
  "description": "Telescope powered feed that queries 'Hello' OR 'World'.",
  "displayName": "Telescope Test",
  "telescopeData": {
    "searchQuery": [
      {
        "query": "Hello"
      },
      {
        "query": "World"
      }
    ]
  }
}