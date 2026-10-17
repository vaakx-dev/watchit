export const README = `# Attribution archive

- titles/ID.json: current public metadata, source links, and image references. Episode IDs use percent-encoded colons in filenames.
- images/KEY.json: image source URLs, credits, licenses, retrieval times, and referring title IDs.
- manual/: documents and notes. Generated writes leave these files unchanged.

Title snapshots are replaced on update. Image records remain after artwork replacement or cache eviction. Null fields mean information was not supplied. Image files are stored separately in the image cache.

URL credentials, queries, and fragments are omitted. Personal library state and playback mappings are not exported.

Writes are atomic per file and serialized within one process. Run only one writer against this directory.
`;
