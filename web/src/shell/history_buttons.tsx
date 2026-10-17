import { ChevronLeft, ChevronRight } from 'lucide-react';
import { use_history_buttons } from '../navigation/use_history_buttons';

export function HistoryButtons() {
  const { back, forward, supported } = use_history_buttons();
  if (!supported) return null;
  return <div className="history-buttons">
    <button type="button" className="icon-button ghost" aria-label="Back" title="Back (Alt+Left)" disabled={!back} onClick={() => history.back()}><ChevronLeft /></button>
    <button type="button" className="icon-button ghost" aria-label="Forward" title="Forward (Alt+Right)" disabled={!forward} onClick={() => history.forward()}><ChevronRight /></button>
  </div>;
}
