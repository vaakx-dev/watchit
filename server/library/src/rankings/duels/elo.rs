pub const START: i64 = 1500;
const SETTLED_AFTER: i64 = 6;

#[derive(Clone, Debug)]
pub struct Duelist {
    pub id: String,
    pub rating: i64,
    pub games: i64,
}

fn k(duelist: &Duelist) -> f64 {
    if duelist.games < SETTLED_AFTER { 40.0 } else { 20.0 }
}

fn expected(first: &Duelist, second: &Duelist) -> f64 {
    1.0 / (1.0 + 10f64.powf((second.rating - first.rating) as f64 / 400.0))
}

fn round(value: f64) -> i64 {
    (value + 0.5).floor() as i64
}

pub fn deltas(first: &Duelist, second: &Duelist, score: f64) -> (i64, i64) {
    let expected = expected(first, second);
    (
        round(k(first) * (score - expected)),
        round(k(second) * ((1.0 - score) - (1.0 - expected))),
    )
}

pub fn gain(duelist: &Duelist, opponent: &Duelist) -> i64 {
    deltas(duelist, opponent, 1.0).0.max(1)
}
