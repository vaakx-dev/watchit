const RESUME_FROM: f64 = 0.05;
const WATCHED_FROM: f64 = 0.9;
const LEAVE_OUT_SECONDS: f64 = 1.0;
const SHORTEST_RESUMABLE_SECONDS: f64 = 300.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Clear,
    Resume,
    Watched,
}

pub fn classify(position: f64, duration: f64) -> Outcome {
    let share = position / duration;
    if share > WATCHED_FROM || duration - position <= LEAVE_OUT_SECONDS {
        Outcome::Watched
    } else if share < RESUME_FROM || duration < SHORTEST_RESUMABLE_SECONDS {
        Outcome::Clear
    } else {
        Outcome::Resume
    }
}
