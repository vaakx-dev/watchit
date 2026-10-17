use std::path::PathBuf;
use std::process::ExitCode;

fn main() -> ExitCode {
    let mut arguments = std::env::args().skip(1);
    let (Some(data_dir), Some(file)) = (arguments.next(), arguments.next()) else {
        eprintln!("usage: import-profiles <data dir> <profiles.json>");
        return ExitCode::FAILURE;
    };
    match watchit_library::import::run(PathBuf::from(data_dir), &PathBuf::from(file)) {
        Ok(()) => {
            println!("Imported.");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("Import failed: {error}");
            ExitCode::FAILURE
        }
    }
}
