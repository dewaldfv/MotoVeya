import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MAX_DURATION = 30;
const MAX_WIDTH = 1080;
const MAX_HEIGHT = 1920;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { clip_id, source_url } = await req.json().catch(() => ({}));
  if (!clip_id || !source_url) return Response.json({ error: 'clip_id and source_url are required.' }, { status: 400 });

  const svc = base44.asServiceRole;
  const clip = await svc.entities.CrowdClip.get(clip_id);
  if (!clip) return Response.json({ error: 'Crowd Clip not found.' }, { status: 404 });
  if (clip.creator_id !== user.id && !['admin', 'moderator'].includes(user.role)) return Response.json({ error: 'Forbidden.' }, { status: 403 });

  let job = null;
  try {
    job = await svc.entities.CrowdClipTranscodeJob.create({ clip_id, source_url, status: 'processing' });
    await svc.entities.CrowdClip.update(clip_id, { processing_status: 'processing', source_media_url: source_url });

    const inputPath = `/tmp/${crypto.randomUUID()}-input`;
    const outputPath = `/tmp/${crypto.randomUUID()}-output.mp4`;
    const thumbPath = `/tmp/${crypto.randomUUID()}-thumb.jpg`;

    const source = await fetch(source_url);
    if (!source.ok || !source.body) throw new Error(`Unable to download source video (${source.status}).`);
    await writeStreamToFile(source.body, inputPath);

    const probe = await runCommand(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath]);
    const duration = Math.min(MAX_DURATION, Math.max(0, Number(probe.stdout.trim()) || MAX_DURATION));

    // Aggressive mobile/social-feed encode: H.264, fast-start MP4, 1080p max,
    // 30fps cap, ~3 Mbps target with a 4 Mbps ceiling, AAC 80 kbps.
    const vf = `scale=w=${MAX_WIDTH}:h=${MAX_HEIGHT}:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30`;
    await runCommand([
      'ffmpeg', '-y', '-ss', '0', '-i', inputPath,
      '-t', String(duration), '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-level', '4.1',
      '-b:v', '3M', '-maxrate', '4M', '-bufsize', '6M',
      '-c:a', 'aac', '-b:a', '80k', '-ac', '2', '-ar', '44100',
      '-movflags', '+faststart', '-pix_fmt', 'yuv420p', outputPath
    ]);

    await runCommand([
      'ffmpeg', '-y', '-ss', '0.5', '-i', outputPath,
      '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '6', thumbPath
    ]);

    const outputBytes = (await Deno.stat(outputPath)).size;
    const outputFile = new File([await Deno.readFile(outputPath)], `crowd-clip-${clip_id}.mp4`, { type: 'video/mp4' });
    const thumbFile = new File([await Deno.readFile(thumbPath)], `crowd-clip-${clip_id}.jpg`, { type: 'image/jpeg' });
    const uploadedVideo = await svc.integrations.Core.UploadFile({ file: outputFile });
    const uploadedThumb = await svc.integrations.Core.UploadFile({ file: thumbFile });

    await svc.entities.CrowdClip.update(clip_id, {
      media_url: uploadedVideo.file_url,
      thumbnail_url: uploadedThumb.file_url,
      media_urls: [uploadedVideo.file_url],
      processing_status: 'ready',
      source_media_url: source_url,
    });
    await svc.entities.CrowdClipTranscodeJob.update(job.id, {
      status: 'ready',
      output_url: uploadedVideo.file_url,
      thumbnail_url: uploadedThumb.file_url,
      duration_seconds: duration,
      output_bytes: outputBytes,
    });

    cleanup([inputPath, outputPath, thumbPath]);
    return Response.json({ success: true, status: 'ready', media_url: uploadedVideo.file_url, thumbnail_url: uploadedThumb.file_url, output_bytes: outputBytes });
  } catch (error) {
    console.error('transcode-crowd-clip error', error);
    if (job?.id) await svc.entities.CrowdClipTranscodeJob.update(job.id, { status: 'failed', error_message: error?.message || 'Transcoding failed.' }).catch(() => {});
    await svc.entities.CrowdClip.update(clip_id, { processing_status: 'failed' }).catch(() => {});
    return Response.json({ error: error?.message || 'Transcoding failed.' }, { status: 500 });
  }
});

async function writeStreamToFile(stream, path) {
  const file = await Deno.open(path, { write: true, create: true, truncate: true });
  try { await stream.pipeTo(file.writable); } finally { file.close(); }
}

async function runCommand(command) {
  const cmd = new Deno.Command(command[0], { args: command.slice(1), stdout: 'piped', stderr: 'piped' });
  const result = await cmd.output();
  const stdout = new TextDecoder().decode(result.stdout);
  const stderr = new TextDecoder().decode(result.stderr);
  if (!result.success) throw new Error(`${command[0]} failed: ${stderr.slice(-2000)}`);
  return { stdout, stderr };
}

async function cleanup(paths) {
  await Promise.all(paths.map((path) => Deno.remove(path).catch(() => {})));
}
