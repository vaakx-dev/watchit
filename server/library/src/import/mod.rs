mod counts;
mod export;
mod insert;

use std::path::{Path, PathBuf};

use rusqlite::TransactionBehavior;
use watchit_core::{AppError, AppResult, Context};
use watchit_profiles::Profiles;

use export::Export;

const WANTED: [&str; 2] = ["dry", "wet"];

pub fn run(data_dir: PathBuf, file: &Path) -> AppResult<()> {
    let export: Export = serde_json::from_slice(&std::fs::read(file)?).map_err(AppError::internal)?;
    let folder = file.parent().unwrap_or(Path::new("."));
    let context = Context::open(data_dir)?;
    Profiles::open(&context)?;
    context.db.run_blocking(|conn| Ok(conn.execute_batch(&crate::tables())?))?;
    context.db.run_blocking(|conn| {
        let existing: i64 = conn.query_row("SELECT COUNT(*) FROM profiles", [], |row| row.get(0))?;
        if existing > 0 {
            return Err(AppError::internal("The database already has profiles. Import into a fresh data directory."));
        }
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let chosen: Vec<_> = export.profiles.iter().filter(|profile| WANTED.contains(&profile.name.as_str())).collect();
        for profile in &chosen {
            insert::profile(&tx, folder, profile)?;
            insert::library(&tx, profile)?;
        }
        let mut mismatched = false;
        for profile in &chosen {
            let expected = counts::expected(profile);
            let stored = counts::stored(&tx, profile.old_id)?;
            println!("{} (id {})\n  export:   {expected:?}\n  imported: {stored:?}", profile.name, profile.old_id);
            mismatched |= expected != stored;
        }
        if mismatched {
            return Err(AppError::internal("Imported counts differ from the export. Nothing was written."));
        }
        tx.commit()?;
        Ok(())
    })
}
