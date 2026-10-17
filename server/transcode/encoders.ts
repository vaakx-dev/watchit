import { execFile } from 'node:child_process';

type Encoder = { name: string; filter: string; options: string[] };

const SOFTWARE: Encoder = {
  name: 'libx264',
  filter: "scale=-2:'min(ih,1080)',format=yuv420p",
  options: ['-preset', 'veryfast', '-crf', '21', '-profile:v', 'high'],
};

const HARDWARE: Encoder[] = [
  { name: 'h264_nvenc', filter: 'format=yuv420p', options: ['-preset', 'p4', '-rc', 'vbr', '-cq', '23', '-b:v', '0', '-profile:v', 'high', '-forced-idr', '1'] },
  { name: 'h264_qsv', filter: 'format=nv12', options: ['-preset', 'veryfast', '-global_quality', '23', '-profile:v', 'high', '-forced_idr', '1'] },
  { name: 'h264_amf', filter: 'format=nv12', options: ['-quality', 'speed', '-rc', 'cqp', '-qp_i', '22', '-qp_p', '22', '-profile:v', 'high'] },
];

function works(encoder: Encoder): Promise<boolean> {
  const args = ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:duration=0.5', '-vf', encoder.filter, '-c:v', encoder.name, ...encoder.options, '-f', 'null', '-'];
  return new Promise(resolve => execFile('ffmpeg', args, { timeout: 15000 }, error => resolve(!error)));
}

async function detect(): Promise<Encoder> {
  for (const encoder of HARDWARE) if (await works(encoder)) return encoder;
  return SOFTWARE;
}

let selected: Promise<Encoder> | undefined;

export function video_encoder(): Promise<Encoder> {
  selected ??= detect();
  return selected;
}
