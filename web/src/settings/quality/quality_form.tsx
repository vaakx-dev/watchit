import { useState } from 'react';
import { Choices } from '../../ui/choices';
import { NumberInput, type NumberSpec } from '../controls/number_input';
import { SettingGroup } from '../controls/setting_group';
import { SettingRow } from '../controls/setting_row';
import { save_quality, type QualityPreferences } from './api';
import { BYTES_PER_GB, LANGUAGES, RESOLUTIONS, STANCES } from './options';

const SIZE: NumberSpec = { id: 'quality-size', label: 'Largest file', hint: 'Bigger releases are hidden.', unit: 'GB', scale: BYTES_PER_GB, min: 0.1, empty: 'No limit' };

type Props = { initial: QualityPreferences; track: <T>(work: Promise<T>) => Promise<T> };

export function QualityForm({ initial, track }: Props) {
  const [quality, set_quality] = useState(initial);

  function change(next: QualityPreferences) {
    const previous = quality;
    set_quality(next);
    track(save_quality(next)).then(set_quality).catch(() => set_quality(previous));
  }

  function toggle_language(code: string) {
    const languages = quality.languages.includes(code) ? quality.languages.filter(item => item !== code) : [...quality.languages, code];
    change({ ...quality, languages });
  }

  return <>
    <SettingGroup>
      <SettingRow label="Preferred resolution" hint="Used first, then the closest lower one, then higher ones.">
        <Choices label="Preferred resolution" look="segmented" options={RESOLUTIONS} value={quality.resolution}
          on_change={resolution => change({ ...quality, resolution })} />
      </SettingRow>
      <NumberInput spec={SIZE} value={quality.max_size_bytes} on_save={max_size_bytes => change({ ...quality, max_size_bytes })} />
    </SettingGroup>
    <SettingGroup title="Picture">
      <SettingRow label="HDR" hint="Avoided releases go to the bottom of the list.">
        <Choices label="HDR" look="segmented" options={STANCES} value={quality.hdr} on_change={hdr => change({ ...quality, hdr })} />
      </SettingRow>
      <SettingRow label="Dolby Vision" hint="Avoid it if your screen shows Dolby Vision with wrong colours.">
        <Choices label="Dolby Vision" look="segmented" options={STANCES} value={quality.dolby_vision}
          on_change={dolby_vision => change({ ...quality, dolby_vision })} />
      </SettingRow>
      <SettingRow label="Cam and screener releases" hint="Low quality cinema recordings and review copies.">
        <Choices label="Cam and screener releases" look="segmented" value={quality.hide_cam ? 'hide' : 'show'}
          options={[{ value: 'hide', label: 'Hide' }, { value: 'show', label: 'Show last' }]}
          on_change={value => change({ ...quality, hide_cam: value === 'hide' })} />
      </SettingRow>
    </SettingGroup>
    <SettingGroup title="Audio">
      <SettingRow label="Languages" hint="Other languages go lower. Pick none for any language." wide>
        <Choices label="Audio languages" options={LANGUAGES.map(language => ({ ...language, status: quality.languages.includes(language.value) ? 'on' : undefined }))}
          value={quality.languages[0] ?? ''} on_change={toggle_language} />
      </SettingRow>
    </SettingGroup>
  </>;
}
