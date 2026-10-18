use std::collections::{HashMap, HashSet};

use rusqlite::Connection;
use watchit_catalog::{Catalog, CatalogEntry, CatalogKind};
use watchit_core::AppResult;

use super::pairing::{Meeting, choose, meeting};
use super::ratings::{Duelist, Outcome, Ratings};
use super::store;
use super::types::{Contender, DuelBoard, DuelRanking, DuelStanding};

const TOP: usize = 5;

struct Season {
    outcomes: Vec<Outcome>,
    ratings: Ratings,
    pool: Vec<Duelist>,
}

fn season(conn: &Connection, profile: i64, kind: CatalogKind) -> AppResult<Season> {
    let outcomes = store::outcomes(conn, profile)?;
    let ratings = Ratings::fit(&outcomes, None);
    let pool = store::watched(conn, profile, kind)?
        .iter()
        .map(|id| ratings.duelist(id))
        .collect();
    Ok(Season { outcomes, ratings, pool })
}

fn standings(pool: &[Duelist]) -> Vec<&Duelist> {
    let mut played: Vec<&Duelist> = pool.iter().filter(|duelist| duelist.games > 0).collect();
    played.sort_by(|a, b| b.rating.total_cmp(&a.rating).then(b.games.cmp(&a.games)));
    played
}

fn gain(season: &Season, winner: &Duelist, loser: &Duelist) -> i64 {
    let win = Outcome {
        first: winner.id.clone(),
        second: loser.id.clone(),
        score: 1.0,
    };
    let after = Ratings::fit(season.outcomes.iter().chain([&win]), Some(&season.ratings));
    after.duelist(&winner.id).shown_rating() - winner.shown_rating()
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
        rating: duelist.shown_rating(),
        games: duelist.games,
    })
}

fn met(conn: &Connection, profile: i64, outcomes: &[Outcome]) -> AppResult<HashSet<Meeting>> {
    let mut met = store::skips(conn, profile)?;
    met.extend(outcomes.iter().map(|outcome| meeting(&outcome.first, &outcome.second)));
    Ok(met)
}

fn pick<'a>(season: &'a Season, conn: &Connection, profile: i64, replay: Option<(String, String)>) -> AppResult<Option<(&'a Duelist, &'a Duelist)>> {
    let pool = &season.pool;
    let find = |id: &str| pool.iter().find(|duelist| duelist.id == id);
    if let Some((first, second)) = replay
        && let (Some(first), Some(second)) = (find(&first), find(&second))
    {
        return Ok(Some((first, second)));
    }
    let met = met(conn, profile, &season.outcomes)?;
    Ok(choose(pool, &met).map(|(first, second)| (&pool[first], &pool[second])))
}

pub fn board(conn: &Connection, catalog: &Catalog, profile: i64, kind: CatalogKind, replay: Option<(String, String)>) -> AppResult<DuelBoard> {
    let season = season(conn, profile, kind)?;
    let pair = pick(&season, conn, profile, replay)?;
    let top: Vec<&Duelist> = standings(&season.pool).into_iter().take(TOP).collect();
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
                rating: duelist.shown_rating(),
                gain: gain(&season, duelist, opponent),
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
        can_undo: !season.outcomes.is_empty(),
    })
}

pub fn ranking(conn: &Connection, catalog: &Catalog, profile: i64, kind: CatalogKind) -> AppResult<DuelRanking> {
    let season = season(conn, profile, kind)?;
    let played = standings(&season.pool);
    let entries = entries(conn, catalog, &played)?;
    let items = played
        .iter()
        .enumerate()
        .filter_map(|(index, duelist)| standing(&entries, index, duelist))
        .collect();
    Ok(DuelRanking { kind, items })
}
