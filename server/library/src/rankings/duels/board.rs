use std::collections::HashMap;

use rusqlite::Connection;
use watchit_catalog::{Catalog, CatalogEntry, CatalogKind};
use watchit_core::AppResult;

use super::elo::{Duelist, gain};
use super::pairing::choose;
use super::store;
use super::types::{Contender, DuelBoard, DuelRanking, DuelStanding};

const TOP: usize = 5;

fn standings(pool: &[Duelist]) -> Vec<&Duelist> {
    let mut played: Vec<&Duelist> = pool.iter().filter(|duelist| duelist.games > 0).collect();
    played.sort_by(|a, b| b.rating.cmp(&a.rating).then(b.games.cmp(&a.games)));
    played
}

fn entries(conn: &Connection, catalog: &Catalog, duelists: &[&Duelist]) -> AppResult<HashMap<String, CatalogEntry>> {
    let ids: Vec<String> = duelists.iter().map(|duelist| duelist.id.clone()).collect();
    let (entries, _) = catalog.entries(conn, &ids)?;
    Ok(entries.into_iter().map(|entry| (entry.id.clone(), entry)).collect())
}

fn standing(entries: &HashMap<String, CatalogEntry>, index: usize, duelist: &Duelist) -> Option<DuelStanding> {
    Some(DuelStanding {
        title: entries.get(&duelist.id)?.clone(),
        rank: index + 1,
        rating: duelist.rating,
        games: duelist.games,
    })
}

fn pick<'a>(pool: &'a [Duelist], conn: &Connection, profile: i64, replay: Option<(String, String)>) -> AppResult<Option<(&'a Duelist, &'a Duelist)>> {
    let find = |id: &str| pool.iter().find(|duelist| duelist.id == id);
    if let Some((first, second)) = replay
        && let (Some(first), Some(second)) = (find(&first), find(&second))
    {
        return Ok(Some((first, second)));
    }
    let met = store::met(conn, profile)?;
    Ok(choose(pool, &met).map(|(first, second)| (&pool[first], &pool[second])))
}

pub fn board(conn: &Connection, catalog: &Catalog, profile: i64, kind: CatalogKind, replay: Option<(String, String)>) -> AppResult<DuelBoard> {
    let pool = store::pool(conn, profile, kind)?;
    let pair = pick(&pool, conn, profile, replay)?;
    let top: Vec<&Duelist> = standings(&pool).into_iter().take(TOP).collect();
    let shown: Vec<&Duelist> = pair
        .iter()
        .flat_map(|(first, second)| [*first, *second])
        .chain(top.iter().copied())
        .collect();
    let entries = entries(conn, catalog, &shown)?;
    let pair = pair
        .into_iter()
        .flat_map(|(first, second)| [(first, second), (second, first)])
        .filter_map(|(duelist, opponent)| {
            Some(Contender {
                title: entries.get(&duelist.id)?.clone(),
                rating: duelist.rating,
                gain: gain(duelist, opponent),
            })
        })
        .collect();
    let top = top
        .iter()
        .enumerate()
        .filter_map(|(index, duelist)| standing(&entries, index, duelist))
        .collect();
    Ok(DuelBoard {
        kind,
        pair,
        top,
        can_undo: store::can_undo(conn, profile)?,
    })
}

pub fn ranking(conn: &Connection, catalog: &Catalog, profile: i64, kind: CatalogKind) -> AppResult<DuelRanking> {
    let pool = store::pool(conn, profile, kind)?;
    let played = standings(&pool);
    let entries = entries(conn, catalog, &played)?;
    let items = played
        .iter()
        .enumerate()
        .filter_map(|(index, duelist)| standing(&entries, index, duelist))
        .collect();
    Ok(DuelRanking { kind, items })
}
