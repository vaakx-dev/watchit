export function FieldHint({ id, error, touched, text }: { id: string; error: string; touched: boolean; text: string }) {
  const failed = touched && Boolean(error);
  return <p id={id} className={failed ? 'cache-hint invalid' : 'cache-hint'}>{failed ? error : text}</p>;
}
