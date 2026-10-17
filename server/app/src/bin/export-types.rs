use std::path::Path;

fn main() -> anyhow::Result<()> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).ancestors().nth(2).expect("app crate sits in server/app");
    let out_dir = root.join("web/src/generated");
    if out_dir.exists() {
        std::fs::remove_dir_all(&out_dir)?;
    }
    let config = ts_rs::Config::new().with_large_int("number").with_out_dir(&out_dir);
    watchit_playback::export_types(&config)?;
    watchit_profiles::export_types(&config)?;
    watchit_torrents::export_types(&config)?;
    watchit_artwork::export_types(&config)?;
    watchit_catalog::export_types(&config)?;
    watchit_library::export_types(&config)?;
    watchit_remote::export_types(&config)?;
    println!("TypeScript types written to {}", out_dir.display());
    Ok(())
}
