import { useState, type ReactNode } from 'react';
import { Choices } from '../../ui/choices';
import { save_quality, type QualityPreferences } from './api';
import { LANGUAGES, RESOLUTIONS, STANCES, to_bytes, to_gigabytes } from './options';

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return <div className="quality-field">
    <h3>{label}</h3>
    <p className="cache-hint">{hint}</p>
    {children}
  </div>;
}

export function QualityForm({ initial }: { initial: QualityPreferences }) {
  const [quality, set_quality] = useState(initial);
  const [size, set_size] = useState(() => to_gigabytes(initial.max_size_bytes));
  const [failure, set_failure] = useState('');

  async function change(next: QualityPreferences) {
    const previous = quality;
    set_quality(next);
    set_failure('');
    try {
      set_quality(await save_quality(next));
    } catch (cause) {
      set_quality(previous);
      set_failure(cause instanceof Error ? cause.message : 'Could not save. Check your connection and try again.');
    }
  }

  function commit_size() {
    const bytes = to_bytes(size);
    if (bytes === 'invalid') return set_failure('Enter a size above zero, or leave it empty for no limit.');
    if (bytes !== quality.max_size_bytes) void change({ ...quality, max_size_bytes: bytes });
  }

  function toggle_language(code: string) {
    const languages = quality.languages.includes(code) ? quality.languages.filter(item => item !== code) : [...quality.languages, code];
    void change({ ...quality, languages });
  }

  return <div className="quality-form">
    <Field label="Preferred resolution" hint="Auto-picks and Download use this first, then the closest lower resolution, then higher ones.">
      <Choices label="Preferred resolution" look="segmented" options={RESOLUTIONS} value={quality.resolution}
        on_change={resolution => void change({ ...quality, resolution })} />
    </Field>
    <Field label="HDR" hint="Avoided releases go to the bottom of the list, whatever their resolution.">
      <Choices label="HDR" look="segmented" options={STANCES} value={quality.hdr} on_change={hdr => void change({ ...quality, hdr })} />
    </Field>
    <Field label="Dolby Vision" hint="Turn this off if your screen shows Dolby Vision with wrong colours.">
      <Choices label="Dolby Vision" look="segmented" options={STANCES} value={quality.dolby_vision}
        on_change={dolby_vision => void change({ ...quality, dolby_vision })} />
    </Field>
    <Field label="Audio languages" hint="Releases in other languages go lower. None selected means any language.">
      <Choices label="Audio languages" options={LANGUAGES.map(language => ({ ...language, status: quality.languages.includes(language.value) ? 'on' : undefined }))}
        value={quality.languages[0] ?? ''} on_change={toggle_language} />
    </Field>
    <div className="quality-field">
      <label htmlFor="quality-size"><h3>Largest file</h3></label>
      <p className="cache-hint">Bigger releases are hidden. Leave empty for no limit.</p>
      <div className="cache-input">
        <input id="quality-size" inputMode="decimal" value={size} placeholder="No limit" onChange={event => set_size(event.target.value)}
          onBlur={commit_size} onKeyDown={event => { if (event.key === 'Enter') commit_size(); }} />
        <span>GB</span>
      </div>
    </div>
    <Field label="Cam and screener releases" hint="Low quality recordings from cinemas and review copies.">
      <Choices label="Cam and screener releases" look="segmented" value={quality.hide_cam ? 'hide' : 'show'}
        options={[{ value: 'hide', label: 'Hide' }, { value: 'show', label: 'Show last' }]}
        on_change={value => void change({ ...quality, hide_cam: value === 'hide' })} />
    </Field>
    {failure && <p role="alert" className="cache-failed">{failure}</p>}
  </div>;
}
