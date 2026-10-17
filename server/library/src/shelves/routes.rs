use axum::Json;
use axum::extract::State;
use watchit_catalog::MediaKind;
use watchit_core::{AppResult, Viewer};

use super::items::build_items;
use super::query::{LibrarySort, Shelf, continue_page, counts, shelf_page};
use super::types::{ContinuePage, LibraryPage};
use crate::Library;
use crate::query::Params;

pub async fn page(State(library): State<Library>, viewer: Viewer, params: Params) -> AppResult<Json<LibraryPage>> {
    let shelf = params.choice("status", "watching", Shelf::parse, "Invalid library status.")?;
    let sort = params.choice("sort", "recent", LibrarySort::parse, "Invalid library sort.")?;
    let kind = params.kind()?;
    let number = params.page()?;
    let catalog = library.catalog.clone();
    let page = library
        .db
        .run(move |conn| {
            let counts = counts(conn, viewer.profile, kind)?;
            let (rows, has_next) = shelf_page(conn, viewer.profile, shelf, kind, sort, number)?;
            let (items, artwork_status) = build_items(conn, &catalog, viewer.profile, &rows)?;
            Ok(LibraryPage { items, page: number, has_next, total: shelf.total(&counts), counts, artwork_status })
        })
        .await?;
    Ok(Json(page))
}

pub async fn continuing(State(library): State<Library>, viewer: Viewer, params: Params) -> AppResult<Json<ContinuePage>> {
    let kind = params.kind()?;
    let number = params.page()?;
    let catalog = library.catalog.clone();
    let page = library
        .db
        .run(move |conn| {
            let (rows, has_next) = continue_page(conn, viewer.profile, kind, number)?;
            let (items, artwork_status) = build_items(conn, &catalog, viewer.profile, &rows)?;
            for item in items.iter().filter(|item| item.title.kind == MediaKind::Series) {
                catalog.episodes_pending(conn, &item.title.id)?;
            }
            Ok(ContinuePage { items, page: number, has_next, artwork_status })
        })
        .await?;
    Ok(Json(page))
}
