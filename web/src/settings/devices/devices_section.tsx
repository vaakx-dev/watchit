import { RemoteSettings } from '../../remote/remote_settings';
import { SectionFrame } from '../controls/section_frame';

export function DevicesSection() {
  return <SectionFrame title="Devices">
    <RemoteSettings />
  </SectionFrame>;
}
