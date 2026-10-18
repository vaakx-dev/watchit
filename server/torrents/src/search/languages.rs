const FLAGS: [(&str, &str); 40] = [
    ("🇬🇧", "en"),
    ("🇯🇵", "ja"),
    ("🇷🇺", "ru"),
    ("🇮🇹", "it"),
    ("🇵🇹", "pt"),
    ("🇪🇸", "es"),
    ("🇲🇽", "es-419"),
    ("🇰🇷", "ko"),
    ("🇨🇳", "zh"),
    ("🇹🇼", "zh-TW"),
    ("🇫🇷", "fr"),
    ("🇩🇪", "de"),
    ("🇳🇱", "nl"),
    ("🇮🇳", "hi"),
    ("🇵🇱", "pl"),
    ("🇱🇹", "lt"),
    ("🇱🇻", "lv"),
    ("🇪🇪", "et"),
    ("🇨🇿", "cs"),
    ("🇸🇰", "sk"),
    ("🇸🇮", "sl"),
    ("🇭🇺", "hu"),
    ("🇷🇴", "ro"),
    ("🇧🇬", "bg"),
    ("🇷🇸", "sr"),
    ("🇭🇷", "hr"),
    ("🇺🇦", "uk"),
    ("🇬🇷", "el"),
    ("🇩🇰", "da"),
    ("🇫🇮", "fi"),
    ("🇸🇪", "sv"),
    ("🇳🇴", "no"),
    ("🇹🇷", "tr"),
    ("🇸🇦", "ar"),
    ("🇮🇷", "fa"),
    ("🇮🇱", "he"),
    ("🇻🇳", "vi"),
    ("🇮🇩", "id"),
    ("🇲🇾", "ms"),
    ("🇹🇭", "th"),
];

pub fn from_flags(line: &str) -> Vec<String> {
    line.split('/')
        .map(str::trim)
        .filter_map(|part| FLAGS.iter().find(|(flag, _)| *flag == part).map(|(_, code)| (*code).to_owned()))
        .collect()
}

pub fn is_flag_line(line: &str) -> bool {
    line.split('/')
        .map(str::trim)
        .any(|part| FLAGS.iter().any(|(flag, _)| *flag == part) || matches!(part, "Multi Audio" | "Multi Subs" | "Dual Audio" | "Dubbed"))
}
