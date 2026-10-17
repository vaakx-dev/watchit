# Source records

- [Cinemeta](sources/cinemeta.md): metadata source and API references.
- [MetaHub](sources/metahub.md): artwork source and terms.
- [IMDb image CDN](sources/imdb.md): posters supplied through Cinemeta search.
- [../data/attribution/](../data/attribution/): generated title and image records.
- [../data/attribution/manual/](../data/attribution/manual/): manual documents and notes.

With `STREAMIT_DATA_DIR`, generated records and manual documents follow that directory.

Title records contain metadata provenance and current image references. Image records retain source URLs, supplied credits, and referring title IDs after replacement or cache eviction. Missing credit fields remain unspecified.
