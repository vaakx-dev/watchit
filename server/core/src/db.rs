use std::path::Path;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;

use crate::AppError;

#[derive(Clone)]
pub struct Db {
    pool: Pool<SqliteConnectionManager>,
}

impl Db {
    pub fn open(file: &Path) -> Result<Self, AppError> {
        let manager = SqliteConnectionManager::file(file).with_init(|conn| {
            conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
        });
        let pool = Pool::builder().max_size(16).build(manager).map_err(AppError::internal)?;
        Ok(Self { pool })
    }

    pub async fn run<T, F>(&self, work: F) -> Result<T, AppError>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection) -> Result<T, AppError> + Send + 'static,
    {
        let pool = self.pool.clone();
        tokio::task::spawn_blocking(move || {
            let mut conn = pool.get().map_err(AppError::internal)?;
            work(&mut conn)
        })
        .await
        .map_err(AppError::internal)?
    }

    pub fn run_blocking<T>(&self, work: impl FnOnce(&mut Connection) -> Result<T, AppError>) -> Result<T, AppError> {
        let mut conn = self.pool.get().map_err(AppError::internal)?;
        work(&mut conn)
    }
}
