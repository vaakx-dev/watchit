export const TITLE_ID = /^tt\d{7,12}(?::\d{1,5}:\d{1,5})?$/;
export const IMDB_ID = /^tt\d{7,12}$/;
export const GENRE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function genre_id(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
