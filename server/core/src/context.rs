use std::path::PathBuf;

use crate::{AppResult, Background, Db, Paths, StreamTokens};

#[derive(Clone)]
pub struct Context {
    pub paths: Paths,
    pub db: Db,
    pub tokens: StreamTokens,
    pub background: Background,
}

impl Context {
    pub fn open(data_dir: PathBuf) -> AppResult<Self> {
        let paths = Paths::new(data_dir)?;
        let db = Db::open(&paths.database())?;
        let tokens = StreamTokens::load(&paths)?;
        Ok(Self {
            paths,
            db,
            tokens,
            background: Background::default(),
        })
    }
}
