const VIRTUAL_TIE: f64 = 0.5;
const TOLERANCE: f64 = 1e-10;
const MAX_SWEEPS: usize = 10_000;

pub struct Edge {
    pub opponent: usize,
    pub wins: f64,
    pub losses: f64,
}

fn update(strengths: &[f64], own: f64, edges: &[Edge]) -> f64 {
    let average = VIRTUAL_TIE / (own + 1.0);
    let (beaten, lost) = edges.iter().fold((average, average), |(beaten, lost), edge| {
        let other = strengths[edge.opponent];
        let weight = 1.0 / (own + other);
        (beaten + edge.wins * other * weight, lost + edge.losses * weight)
    });
    beaten / lost
}

pub fn solve(edges: &[Vec<Edge>], mut strengths: Vec<f64>) -> Vec<f64> {
    for _ in 0..MAX_SWEEPS {
        let mut largest_step = 0f64;
        for (player, own_edges) in edges.iter().enumerate() {
            let next = update(&strengths, strengths[player], own_edges);
            largest_step = largest_step.max((next / strengths[player]).ln().abs());
            strengths[player] = next;
        }
        if largest_step < TOLERANCE {
            break;
        }
    }
    strengths
}
