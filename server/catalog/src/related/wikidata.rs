use std::collections::HashMap;
use std::time::Duration;

use reqwest::header::{ACCEPT, USER_AGENT};
use serde::Deserialize;

use crate::ids::is_imdb_id;

const ENDPOINT: &str = "https://query.wikidata.org/sparql";
const TIMEOUT: Duration = Duration::from_secs(20);
const CHAIN_REACH: usize = 4;

#[derive(Clone, Debug, Default)]
pub(crate) struct FranchiseList {
    pub name: Option<String>,
    pub ids: Vec<String>,
}

#[derive(Default)]
struct Row {
    series: Option<String>,
    name: Option<String>,
    imdb: String,
    ordinal: Option<String>,
    date: Option<String>,
}

struct Member {
    imdb: String,
    ordinal: f64,
    date: String,
}

#[derive(Deserialize)]
struct Response {
    results: Results,
}

#[derive(Deserialize)]
struct Results {
    bindings: Vec<HashMap<String, Binding>>,
}

#[derive(Deserialize)]
struct Binding {
    value: String,
}

fn query(imdb_id: &str) -> String {
    let neighbours = (1..=4)
        .flat_map(|steps| ["P155", "P156"].map(|property| vec![format!("wdt:{property}"); steps].join("/")))
        .collect::<Vec<_>>()
        .join("|");
    format!(
        "SELECT ?series ?name ?imdb (SAMPLE(?position) AS ?ordinal) (MIN(?published) AS ?date) WHERE {{
    hint:Query hint:optimizer \"None\" .
    ?item wdt:P345 \"{imdb_id}\" .
    {{
      ?item wdt:P179 ?series . ?statement ps:P179 ?series . ?member p:P179 ?statement .
      OPTIONAL {{ ?statement pq:P1545 ?position }}
      OPTIONAL {{ ?series rdfs:label ?name FILTER(LANG(?name) = \"en\") }}
    }} UNION {{ ?item {neighbours} ?member }} UNION {{ ?item wdt:P345 ?own . BIND(?item AS ?member) }}
    ?member wdt:P345 ?imdb .
    OPTIONAL {{ ?member wdt:P577 ?published }}
  }} GROUP BY ?series ?name ?imdb"
    )
}

fn members<'a>(rows: impl Iterator<Item = &'a Row>) -> Vec<Member> {
    let mut unique: Vec<Member> = Vec::new();
    for row in rows {
        if !is_imdb_id(&row.imdb) || unique.iter().any(|member| member.imdb == row.imdb) {
            continue;
        }
        let ordinal = row.ordinal.as_deref().and_then(leading_number).unwrap_or(f64::INFINITY);
        unique.push(Member { imdb: row.imdb.clone(), ordinal, date: row.date.clone().unwrap_or_else(|| "9999".into()) });
    }
    unique.sort_by(|left, right| left.ordinal.total_cmp(&right.ordinal).then_with(|| left.date.cmp(&right.date)).then_with(|| left.imdb.cmp(&right.imdb)));
    unique
}

fn leading_number(text: &str) -> Option<f64> {
    let text = text.trim_start();
    let end = text
        .char_indices()
        .take_while(|(index, char)| char.is_ascii_digit() || *char == '.' || (*index == 0 && (*char == '-' || *char == '+')))
        .map(|(index, char)| index + char.len_utf8())
        .last()?;
    text[..end].parse().ok()
}

fn smallest_series(id: &str, rows: &[Row]) -> Option<FranchiseList> {
    let mut groups: Vec<(&str, Vec<&Row>)> = Vec::new();
    for row in rows {
        let Some(series) = row.series.as_deref() else { continue };
        match groups.iter_mut().find(|(key, _)| *key == series) {
            Some((_, group)) => group.push(row),
            None => groups.push((series, vec![row])),
        }
    }
    groups
        .into_iter()
        .map(|(_, group)| (group[0].name.clone(), members(group.into_iter())))
        .filter(|(_, list)| list.len() > 1 && list.iter().any(|member| member.imdb == id))
        .min_by_key(|(_, list)| list.len())
        .map(|(name, list)| FranchiseList { name, ids: list.into_iter().map(|member| member.imdb).collect() })
}

fn chain(id: &str, rows: &[Row]) -> FranchiseList {
    let list = members(rows.iter().filter(|row| row.series.is_none()));
    if list.len() < 2 {
        return FranchiseList::default();
    }
    let index = list.iter().position(|member| member.imdb == id).map_or(-1, |index| index as isize);
    let start = (index - CHAIN_REACH as isize).max(0) as usize;
    let end = ((index + CHAIN_REACH as isize + 1).max(0) as usize).min(list.len());
    FranchiseList { name: None, ids: list[start..end.max(start)].iter().map(|member| member.imdb.clone()).collect() }
}

pub(crate) async fn fetch_franchise(client: &reqwest::Client, imdb_id: &str) -> Result<FranchiseList, String> {
    let response = client
        .get(ENDPOINT)
        .query(&[("query", query(imdb_id))])
        .header(USER_AGENT, "Watchit/1.0 (personal app; no API key)")
        .header(ACCEPT, "application/sparql-results+json")
        .timeout(TIMEOUT)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Wikidata answered {}.", response.status().as_u16()));
    }
    let body: Response = response.json().await.map_err(|error| error.to_string())?;
    let rows: Vec<Row> = body
        .results
        .bindings
        .into_iter()
        .map(|mut binding| {
            let mut take = |key: &str| binding.remove(key).map(|binding| binding.value);
            Row { series: take("series"), name: take("name"), imdb: take("imdb").unwrap_or_default(), ordinal: take("ordinal"), date: take("date") }
        })
        .collect();
    Ok(smallest_series(imdb_id, &rows).unwrap_or_else(|| chain(imdb_id, &rows)))
}
