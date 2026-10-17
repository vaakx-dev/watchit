use rusqlite::{Connection, params_from_iter};
use watchit_core::AppResult;

use crate::status::Status;

pub fn ids(conn: &Connection, profile: i64, statuses: &[Status]) -> AppResult<Vec<String>> {
    if statuses.is_empty() {
        return Ok(Vec::new());
    }
    let marks = vec!["?"; statuses.len()].join(", ");
    let sql = format!("SELECT id FROM library_entries WHERE profile_id = ? AND status IN ({marks})");
    let parameters = std::iter::once(rusqlite::types::Value::Integer(profile))
        .chain(statuses.iter().map(|status| rusqlite::types::Value::Text(status.as_str().to_owned())));
    let ids = conn.prepare_cached(&sql)?.query_map(params_from_iter(parameters), |row| row.get(0))?.collect::<rusqlite::Result<_>>()?;
    Ok(ids)
}
