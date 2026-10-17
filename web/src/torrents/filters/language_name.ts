const names = new Intl.DisplayNames(['en'], { type: 'language' });

export function language_name(code: string) {
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}
