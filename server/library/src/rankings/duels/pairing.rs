use std::collections::HashSet;

use super::elo::Duelist;
use super::random;

const CLOSEST: usize = 3;

pub type Meeting = (String, String);

pub fn meeting(first: &str, second: &str) -> Meeting {
    if first <= second {
        (first.to_owned(), second.to_owned())
    } else {
        (second.to_owned(), first.to_owned())
    }
}

pub fn choose(pool: &[Duelist], met: &HashSet<Meeting>) -> Option<(usize, usize)> {
    if pool.len() < 2 {
        return None;
    }
    let mut order: Vec<usize> = (0..pool.len()).collect();
    random::shuffle(&mut order);
    order.sort_by_key(|&index| pool[index].games);
    let first = order[0];
    let others: Vec<usize> = (0..pool.len()).filter(|&index| index != first).collect();
    let fresh: Vec<usize> = others
        .iter()
        .copied()
        .filter(|&index| !met.contains(&meeting(&pool[first].id, &pool[index].id)))
        .collect();
    let mut candidates = if fresh.is_empty() { others } else { fresh };
    candidates.sort_by_key(|&index| (pool[index].rating - pool[first].rating).abs());
    let second = candidates[random::below(candidates.len().min(CLOSEST))];
    Some(if random::below(2) == 0 { (first, second) } else { (second, first) })
}
