const LANGUAGES: [(&str, &[&str]); 32] = [
    ("en", &["english", "eng"]),
    ("es", &["spanish", "spa", "español", "espanol", "castellano"]),
    ("es-419", &["latino", "latam"]),
    ("fr", &["french", "fre", "fra", "français", "francais"]),
    ("de", &["german", "ger", "deu", "deutsch"]),
    ("it", &["italian", "ita", "italiano"]),
    ("pt", &["portuguese", "por", "português", "portugues"]),
    ("pt-BR", &["brazilian", "brazil", "pob", "ptbr"]),
    ("nl", &["dutch", "dut", "nld", "nederlands"]),
    ("ru", &["russian", "rus"]),
    ("ja", &["japanese", "jpn"]),
    ("zh", &["chinese", "chi", "zho", "chs", "cht"]),
    ("ko", &["korean", "kor"]),
    ("ar", &["arabic", "ara"]),
    ("hi", &["hindi", "hin"]),
    ("pl", &["polish", "pol"]),
    ("sv", &["swedish", "swe"]),
    ("no", &["norwegian", "nor", "nob"]),
    ("da", &["danish", "dan"]),
    ("fi", &["finnish", "fin"]),
    ("tr", &["turkish", "tur"]),
    ("el", &["greek", "gre", "ell"]),
    ("he", &["hebrew", "heb"]),
    ("cs", &["czech", "cze", "ces"]),
    ("hu", &["hungarian", "hun"]),
    ("ro", &["romanian", "rum", "ron"]),
    ("uk", &["ukrainian", "ukr"]),
    ("vi", &["vietnamese", "vie"]),
    ("id", &["indonesian", "ind"]),
    ("th", &["thai", "tha"]),
    ("hr", &["croatian", "hrv"]),
    ("bg", &["bulgarian", "bul"]),
];

fn named(token: &str) -> Option<&'static str> {
    LANGUAGES.iter().find(|(_, names)| names.contains(&token)).map(|(code, _)| *code)
}

fn coded(token: &str) -> Option<&'static str> {
    LANGUAGES.iter().find(|(code, _)| code.eq_ignore_ascii_case(token)).map(|(code, _)| *code)
}

pub fn detect(tokens: &[String]) -> Option<&'static str> {
    let by_name = tokens.iter().rev().find_map(|token| named(token));
    by_name.or_else(|| tokens.last().and_then(|token| coded(token)))
}
