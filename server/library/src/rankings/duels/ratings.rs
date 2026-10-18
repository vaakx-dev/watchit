use std::collections::HashMap;

use super::fit::{Edge, solve};

const AVERAGE: f64 = 1500.0;
const SCALE: f64 = 400.0;

pub struct Outcome {
    pub first: String,
    pub second: String,
    pub score: f64,
}

#[derive(Clone, Debug)]
pub struct Duelist {
    pub id: String,
    pub rating: f64,
    pub games: i64,
}

impl Duelist {
    pub fn shown_rating(&self) -> i64 {
        self.rating.round() as i64
    }
}

fn strength(rating: f64) -> f64 {
    10f64.powf((rating - AVERAGE) / SCALE)
}

fn rating(strength: f64) -> f64 {
    AVERAGE + SCALE * strength.log10()
}

#[derive(Default)]
struct Field<'a> {
    ids: Vec<&'a str>,
    index: HashMap<&'a str, usize>,
    slots: HashMap<(usize, usize), usize>,
    edges: Vec<Vec<Edge>>,
}

impl<'a> Field<'a> {
    fn player(&mut self, id: &'a str) -> usize {
        if let Some(&player) = self.index.get(id) {
            return player;
        }
        self.index.insert(id, self.ids.len());
        self.ids.push(id);
        self.edges.push(Vec::new());
        self.ids.len() - 1
    }

    fn credit(&mut self, player: usize, opponent: usize, score: f64) {
        let slot = *self.slots.entry((player, opponent)).or_insert_with(|| {
            self.edges[player].push(Edge { opponent, wins: 0.0, losses: 0.0 });
            self.edges[player].len() - 1
        });
        let edge = &mut self.edges[player][slot];
        edge.wins += score;
        edge.losses += 1.0 - score;
    }

    fn record(&mut self, outcome: &'a Outcome) {
        let first = self.player(&outcome.first);
        let second = self.player(&outcome.second);
        self.credit(first, second, outcome.score);
        self.credit(second, first, 1.0 - outcome.score);
    }
}

fn games(edges: &[Edge]) -> i64 {
    edges.iter().map(|edge| edge.wins + edge.losses).sum::<f64>().round() as i64
}

pub struct Ratings(HashMap<String, (f64, i64)>);

impl Ratings {
    pub fn fit<'a>(outcomes: impl IntoIterator<Item = &'a Outcome>, start: Option<&Ratings>) -> Self {
        let mut field = Field::default();
        outcomes.into_iter().for_each(|outcome| field.record(outcome));
        let initial = field
            .ids
            .iter()
            .map(|id| start.map_or(1.0, |ratings| strength(ratings.duelist(id).rating)))
            .collect();
        let strengths = solve(&field.edges, initial);
        let fitted = field
            .ids
            .iter()
            .zip(strengths)
            .zip(&field.edges)
            .map(|((id, strength), edges)| (id.to_string(), (rating(strength), games(edges))))
            .collect();
        Self(fitted)
    }

    pub fn duelist(&self, id: &str) -> Duelist {
        let (rating, games) = self.0.get(id).copied().unwrap_or((AVERAGE, 0));
        Duelist {
            id: id.to_owned(),
            rating,
            games,
        }
    }
}
