use std::hash::{BuildHasher, RandomState};

pub fn below(count: usize) -> usize {
    (RandomState::new().hash_one(count) % count as u64) as usize
}

pub fn shuffle<T>(items: &mut [T]) {
    for index in (1..items.len()).rev() {
        items.swap(index, below(index + 1));
    }
}
