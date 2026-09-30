import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import LoginPrompt from '@/components/LoginPrompt';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Camera, Clapperboard, Heart, MessageCircle, MapPin, Plus, Send,
  UserPlus, UserCheck, Upload, Video, X, LocateFixed, Share2, Bookmark,
  MoreVertical, Volume2, VolumeX, Play, Pause
} from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 50;

function avatarFor(clip) {
  return clip.creator_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(clip.creator_name || 'Rider')}&background=random`;
}

export default function CrowdClips() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [mediaPermission, setMediaPermission] = useState('unknown');
  const [requestingMediaPermission, setRequestingMediaPermission] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [mediaType, setMediaType] = useState('photo');
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState(null);
  const [commentClip, setCommentClip] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [following, setFollowing] = useState(new Set());
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoTrimStart, setVideoTrimStart] = useState(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState(30);
  const [videoNeedsTrim, setVideoNeedsTrim] = useState(false);
  const [mutedClips, setMutedClips] = useState(true);
  const videoRefs = useRef(new Map());
  const lastTapRef = useRef({ time: 0, clipId: null });
  const observerRef = useRef(null);

  const requestMediaPermissions = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaPermission('unsupported');
      toast.error('Camera and microphone access is not available in this browser.');
      return false;
    }
    setRequestingMediaPermission(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMediaPermission('granted');
      return true;
    } catch (error) {
      setMediaPermission(error?.name === 'NotAllowedError' ? 'denied' : 'error');
      toast.error('Camera and microphone permission is required to record a Crowd Clip.');
      return false;
    } finally {
      setRequestingMediaPermission(false);
    }
  };

  const openComposer = async () => {
    setComposerOpen(true);
    await requestMediaPermissions();
  };

  const { data, isLoading } = useQuery({
    queryKey: ['crowd-clips'],
    queryFn: async () => {
      const [clips, likes, comments, follows] = await Promise.all([
        base44.entities.CrowdClip.filter({ status: 'published' }, '-created_date', PAGE_SIZE),
        base44.entities.CrowdClipLike.list('-created_date', 500),
        base44.entities.CrowdClipComment.list('-created_date', 500),
        base44.entities.CrowdClipFollow.list('-created_date', 500),
      ]);
      return { clips: clips || [], likes: likes || [], comments: comments || [], follows: follows || [] };
    },
  });

  const clips = data?.clips || [];
  const likes = data?.likes || [];
  const comments = data?.comments || [];
  const follows = data?.follows || [];

  useEffect(() => {
    if (!user) return;
    setFollowing(new Set(follows.filter((f) => f.follower_id === user.id).map((f) => f.creator_id)));
  }, [follows, user]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          document.querySelectorAll('[data-crowd-video]').forEach((other) => {
            if (other !== video) {
              other.pause();
              other.currentTime = 0;
            }
          });
          video.currentTime = 0;
          video.muted = mutedClips;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: [0.2, 0.65, 0.9] });
    observerRef.current = observer;
    videoRefs.current.forEach((video) => observer.observe(video));
    return () => observer.disconnect();
  }, [clips.length, mutedClips]);

  const registerVideo = (clipId, node) => {
    if (!node) return;
    videoRefs.current.set(clipId, node);
    node.muted = mutedClips;
    node.preload = 'auto';
    observerRef.current?.observe(node);
  };

  useEffect(() => {
    const preloadNearby = () => {
      const entries = clips.map((clip, index) => ({ clip, index, video: videoRefs.current.get(clip.id) })).filter((item) => item.video);
      const visible = entries.find((item) => {
        const rect = item.video.getBoundingClientRect();
        return rect.top < window.innerHeight * 0.7 && rect.bottom > window.innerHeight * 0.3;
      });
      if (!visible) return;
      [visible.index + 1, visible.index + 2].forEach((index) => {
        const next = clips[index];
        const video = next && videoRefs.current.get(next.id);
        if (video && video.readyState < 3) {
          video.preload = 'auto';
          try { video.load(); } catch (_) {}
        }
      });
    };
    const timer = window.setTimeout(preloadNearby, 250);
    return () => window.clearTimeout(timer);
  }, [clips]);

  const handleVideoTap = (clipId) => {
    const now = Date.now();
    const last = lastTapRef.current;
    const video = videoRefs.current.get(clipId);
    if (!video) return;
    if (last.clipId === clipId && now - last.time < 280) {
      lastTapRef.current = { time: 0, clipId: null };
      const clip = clips.find((item) => item.id === clipId);
      if (clip && !likeSet.has(clipId)) toggleLike.mutate(clip);
      return;
    }
    lastTapRef.current = { time: now, clipId };
    window.setTimeout(() => {
      if (lastTapRef.current.clipId === clipId && lastTapRef.current.time === now) {
        if (video.paused) video.play().catch(() => {}); else video.pause();
      }
    }, 300);
  };

  const shareClip = async (clip) => {
    const shareData = { title: 'MotoVeya Crowd Clip', text: clip.caption || 'Check out this Crowd Clip on MotoVeya' };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard?.writeText(window.location.href);
    } catch (_) {}
  };

  const likeSet = useMemo(() => new Set(likes.filter((l) => l.user_id === user?.id).map((l) => l.clip_id)), [likes, user?.id]);
  const commentsByClip = useMemo(() => comments.reduce((acc, c) => {
    (acc[c.clip_id] ||= []).push(c);
    return acc;
  }, {}), [comments]);
  const likesByClip = useMemo(() => likes.reduce((acc, l) => {
    (acc[l.clip_id] ||= []).push(l);
    return acc;
  }, {}), [likes]);

  const toggleLike = useMutation({
    mutationFn: async (clip) => {
      const existing = likes.find((l) => l.clip_id === clip.id && l.user_id === user.id);
      if (existing) await base44.entities.CrowdClipLike.delete(existing.id);
      else {
        await base44.entities.CrowdClipLike.create({ clip_id: clip.id, user_id: user.id });
        await base44.functions.invoke('crowd-clips-notify', {
          action: 'like', clip_id: clip.id, creator_id: clip.creator_id, clip_caption: clip.caption || ''
        });
      }
    },
    onMutate: async (clip) => {
      await queryClient.cancelQueries({ queryKey: ['crowd-clips'] });
      const previous = queryClient.getQueryData(['crowd-clips']);
      const existing = previous?.likes?.find((l) => l.clip_id === clip.id && l.user_id === user.id);
      queryClient.setQueryData(['crowd-clips'], (old) => {
        if (!old) return old;
        if (existing) return { ...old, likes: old.likes.filter((l) => l.id !== existing.id) };
        return { ...old, likes: [...old.likes, { id: `temp-${Date.now()}`, clip_id: clip.id, user_id: user.id }] };
      });
      return { previous };
    },
    onError: (_e, _clip, context) => context?.previous && queryClient.setQueryData(['crowd-clips'], context.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['crowd-clips'] }),
  });

  const followMutation = useMutation({
    mutationFn: async ({ creatorId, creatorName }) => {
      const existing = follows.find((f) => f.creator_id === creatorId && f.follower_id === user.id);
      if (existing) await base44.entities.CrowdClipFollow.delete(existing.id);
      else {
        await base44.entities.CrowdClipFollow.create({ creator_id: creatorId, follower_id: user.id, creator_name: creatorName });
        await base44.functions.invoke('crowd-clips-notify', {
          action: 'follow', creator_id: creatorId
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['crowd-clips'] }),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ clipId, text }) => {
      const clip = clips.find((item) => item.id === clipId);
      const comment = await base44.entities.CrowdClipComment.create({
        clip_id: clipId,
        user_id: user.id,
        user_name: user.nickname || user.full_name || 'Rider',
        user_avatar_url: user.avatar_url || '',
        text: text.trim(),
      });
      if (clip) {
        await base44.functions.invoke('crowd-clips-notify', {
          action: 'comment', clip_id: clipId, creator_id: clip.creator_id, clip_caption: clip.caption || ''
        });
      }
      return comment;
    },
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['crowd-clips'] });
    },
  });

  const resetComposer = () => {
    mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
    setComposerOpen(false);
    setMediaFile(null);
    setMediaFiles([]);
    setMediaPreview('');
    setMediaPreviews([]);
    setMediaType('photo');
    setCaption('');
    setLocationName('');
    setLocationCoords(null);
    setVideoDuration(0);
    setVideoTrimStart(0);
    setVideoTrimEnd(30);
    setVideoNeedsTrim(false);
  };

  const selectMedia = (file, type) => {
    if (!file) return;
    if (!file.type.startsWith(type === 'video' ? 'video/' : 'image/')) {
      toast.error(`Please select a ${type}.`);
      return;
    }
    const preview = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaFiles([file]);
    setMediaType(type);
    setMediaPreview(preview);
    setMediaPreviews([preview]);
    if (type === 'video') {
      setVideoDuration(0);
      setVideoTrimStart(0);
      setVideoTrimEnd(30);
      setVideoNeedsTrim(false);
    }
  };

  const compressPhoto = async (file) => {
    const preview = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = preview;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      const maxEdge = 1920;
      const scale = Math.min(maxEdge / image.naturalWidth, maxEdge / image.naturalHeight, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob) throw new Error('Photo compression failed.');
      return new File([blob], file.name.replace(/\\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(preview);
    }
  };

  const selectGalleryMedia = async (files) => {
    const selected = Array.from(files || []).filter((candidate) =>
      candidate.type.startsWith('image/') || candidate.type.startsWith('video/')
    );
    if (!selected.length) return;
    const hasVideo = selected.some((file) => file.type.startsWith('video/'));
    if (hasVideo) {
      const video = selected.find((file) => file.type.startsWith('video/'));
      const preview = URL.createObjectURL(video);
      setMediaFile(video);
      setMediaFiles([video]);
      setMediaType('video');
      setMediaPreview(preview);
      setMediaPreviews([preview]);
      if (selected.length > 1) toast.info('Videos are posted one at a time. The selected video was loaded.');
      setVideoDuration(0);
      setVideoTrimStart(0);
      setVideoTrimEnd(30);
      setVideoNeedsTrim(false);
      return;
    }
    const photos = selected.slice(0, 10);
    const compressedPhotos = await Promise.all(photos.map(compressPhoto));
    const previews = compressedPhotos.map((file) => URL.createObjectURL(file));
    setMediaFile(compressedPhotos[0]);
    setMediaFiles(compressedPhotos);
    setMediaType('photo');
    setMediaPreview(previews[0]);
    setMediaPreviews(previews);
    if (selected.length > 10) toast.info('Crowd Clips supports up to 10 photos per post. The first 10 were selected.');
    toast.success(`${compressedPhotos.length} photo${compressedPhotos.length === 1 ? '' : 's'} optimized for upload`);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not available on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        if (!locationName) setLocationName('Current location');
        toast.success('Location added');
      },
      () => toast.error('Could not access your location.')
    );
  };

  const createTrimmedVideo = async () => {
    if (!mediaFile || mediaType !== 'video') return mediaFile;
    if (!window.MediaRecorder || !HTMLVideoElement.prototype.captureStream) {
      throw new Error('This device/browser cannot process videos in the browser. Please use a video of 30 seconds or less.');
    }
    const video = document.createElement('video');
    video.src = mediaPreview;
    video.muted = true;
    video.playsInline = true;
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });

    // Preserve the source aspect ratio while capping the long edge at 1080p.
    const scale = Math.min(1920 / video.videoWidth, 1080 / video.videoHeight, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const ctx = canvas.getContext('2d', { alpha: false });
    const sourceStream = video.captureStream();
    const canvasStream = canvas.captureStream(30);
    sourceStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
    // Prefer a broadly supported MP4/H.264 profile when the browser exposes it.
    // Fall back to WebM only on browsers that cannot record MP4 from MediaRecorder.
    const preferredTypes = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
    ];
    const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('This device cannot encode a supported Crowd Clip video.');
    const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 4500000, audioBitsPerSecond: 96000 });
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
    video.currentTime = Math.min(videoTrimStart, Math.max(0, video.duration - 0.05));
    await new Promise((resolve) => { video.onseeked = resolve; });
    const drawFrame = () => { if (!video.paused && !video.ended) { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); requestAnimationFrame(drawFrame); } };
    recorder.start(250);
    await video.play();
    drawFrame();
    await new Promise((resolve) => setTimeout(resolve, Math.min(30000, (videoTrimEnd - videoTrimStart) * 1000)));
    video.pause();
    recorder.stop();
    await stopped;
    sourceStream.getTracks().forEach((track) => track.stop());
    canvasStream.getTracks().forEach((track) => track.stop());
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    return new File([new Blob(chunks, { type: mimeType })], `crowd-clip-mobile-1080p.${extension}`, { type: mimeType });
  };

  const publishClip = useMutation({
    mutationFn: async () => {
      if (!mediaFile) throw new Error('Choose a photo or video first.');
      if (mediaType === 'video' && videoDuration > 30 && Math.round(videoTrimEnd - videoTrimStart) !== 30) {
        throw new Error('Please select exactly 30 seconds of the video before publishing.');
      }
      const uploadFiles = mediaType === 'video' ? [await createTrimmedVideo()] : mediaFiles;
      if (mediaType === 'photo' && (!uploadFiles.length || uploadFiles.length > 10)) {
        throw new Error('A photo post must contain between 1 and 10 photos.');
      }
      const uploadedUrls = [];
      for (const file of uploadFiles) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(file_url);
      }
      const primaryUrl = uploadedUrls[0];
      return base44.entities.CrowdClip.create({
        media_type: mediaType,
        media_url: primaryUrl,
        media_urls: uploadedUrls,
        caption: caption.trim(),
        creator_id: user.id,
        creator_name: user.nickname || user.full_name || 'Rider',
        creator_avatar_url: user.avatar_url || '',
        location_name: locationName.trim(),
        location_lat: locationCoords?.lat,
        location_lng: locationCoords?.lng,
        like_count: 0,
        comment_count: 0,
        status: 'published',
        visibility: 'public',
      });
    },
    onSuccess: () => {
      toast.success('Posted to Crowd Clips');
      resetComposer();
      queryClient.invalidateQueries({ queryKey: ['crowd-clips'] });
    },
    onError: (error) => toast.error(error?.message || 'Could not publish your clip.'),
  });

  if (!user) return <LoginPrompt message="Log in to watch and share Crowd Clips" />;

  return (
    <div className="h-[100svh] overflow-hidden bg-black" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="absolute left-0 right-0 top-0 z-30 bg-gradient-to-b from-black/75 via-black/25 to-transparent px-4 pb-8 pt-3">
        <div className="mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Clapperboard size={21} />
            <h1 className="text-lg font-bold">Crowd Clips</h1>
          </div>
          <Button size="icon" variant="ghost" className="rounded-full text-white hover:bg-white/15 hover:text-white" onClick={openComposer} aria-label="Create Crowd Clip">
            <Plus size={22} />
          </Button>
        </div>
      </div>

      <main className="h-full w-full">
        {isLoading ? (
          <div className="flex h-full items-center justify-center bg-black text-white/70">Loading clips…</div>
        ) : clips.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center bg-black px-8 text-center text-white">
            <div className="mb-4 rounded-full bg-white/10 p-5"><Clapperboard size={42} /></div>
            <h2 className="text-xl font-bold">Be the first on Crowd Clips</h2>
            <p className="mt-2 max-w-sm text-sm text-white/60">Share your ride, your bike, a great road or a place other riders need to see.</p>
            <Button className="mt-5" onClick={openComposer}><Camera size={18} className="mr-2" /> Create a Clip</Button>
          </div>
        ) : (
          <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {clips.map((clip) => {
              const liked = likeSet.has(clip.id);
              const isFollowing = following.has(clip.creator_id) || clip.creator_id === user.id;
              const clipComments = commentsByClip[clip.id] || [];
              const clipLikes = likesByClip[clip.id] || [];
              return (
                <article key={clip.id} className="relative h-[100svh] w-full snap-start snap-always overflow-hidden bg-black">
                  {clip.media_type === 'video' ? (
                    <video
                      ref={(node) => registerVideo(clip.id, node)}
                      data-crowd-video
                      src={clip.media_url}
                      playsInline
                      loop
                      preload="auto"
                      muted={mutedClips}
                      onClick={() => handleVideoTap(clip.id)}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {(clip.media_urls?.length ? clip.media_urls : [clip.media_url]).map((url, index) => (
                        <img key={url} src={url} alt={`${clip.caption || 'Crowd Clip'} photo ${index + 1}`} className="h-full w-full shrink-0 snap-center object-cover" />
                      ))}
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/20" />

                  <div className="absolute bottom-24 left-4 right-20 z-10 text-white">
                    <div className="mb-3 flex items-center gap-3">
                      <img src={avatarFor(clip)} alt="" className="h-11 w-11 rounded-full border-2 border-white/80 object-cover" />
                      <div className="min-w-0">
                        <p className="truncate font-bold">@{(clip.creator_name || 'Rider').replace(/\\s+/g, '').toLowerCase()}</p>
                        {clip.creator_id !== user.id && (
                          <button type="button" onClick={() => followMutation.mutate({ creatorId: clip.creator_id, creatorName: clip.creator_name })} className="mt-0.5 text-xs font-semibold text-white/80">
                            {isFollowing ? 'Following' : '+ Follow'}
                          </button>
                        )}
                      </div>
                    </div>
                    {clip.caption && <p className="mb-2 whitespace-pre-wrap text-sm leading-5">{clip.caption}</p>}
                    {clip.location_name && <div className="flex items-center gap-1.5 text-xs font-medium text-white/85"><MapPin size={14} /> <span className="truncate">{clip.location_name}</span></div>}
                  </div>

                  {clip.media_type === 'photo' && (clip.media_urls?.length || 1) > 1 && (
                    <div className="absolute right-4 top-20 z-10 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                      {clip.media_urls?.length || 1} photos • swipe
                    </div>
                  )}

                  <div className="absolute bottom-24 right-3 z-10 flex w-14 flex-col items-center gap-4 text-white">
                    <button type="button" aria-label="Like" onClick={() => toggleLike.mutate(clip)} className="flex flex-col items-center gap-1">
                      <Heart size={29} fill={liked ? 'currentColor' : 'none'} className={liked ? 'text-red-500' : ''} />
                      <span className="text-xs font-semibold">{clipLikes.length}</span>
                    </button>
                    <button type="button" aria-label="Comments" onClick={() => setCommentClip(clip)} className="flex flex-col items-center gap-1">
                      <MessageCircle size={29} />
                      <span className="text-xs font-semibold">{clipComments.length}</span>
                    </button>
                    <button type="button" aria-label="Share" onClick={() => shareClip(clip)} className="flex flex-col items-center gap-1">
                      <Share2 size={28} />
                      <span className="text-xs font-semibold">Share</span>
                    </button>
                    <button type="button" aria-label="Save" className="flex flex-col items-center gap-1">
                      <Bookmark size={28} />
                      <span className="text-xs font-semibold">Save</span>
                    </button>
                    {clip.media_type === 'video' && (
                      <button type="button" aria-label="Toggle sound" onClick={() => { const next = !mutedClips; setMutedClips(next); const video = videoRefs.current.get(clip.id); if (video) video.muted = next; }} className="rounded-full bg-black/35 p-2 backdrop-blur">
                        {mutedClips ? <VolumeX size={22} /> : <Volume2 size={22} />}
                      </button>
                    )}
                  </div>

                  <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[11px] font-medium text-white/55">Swipe up for more</div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={composerOpen} onOpenChange={(open) => !open && resetComposer()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Create Crowd Clip</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {mediaPermission !== 'granted' && mediaPermission !== 'unsupported' && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="font-semibold">Camera & microphone access</p>
                <p className="mt-1 text-xs text-muted-foreground">MotoVeya needs camera and microphone access to record Crowd Clips directly in the app.</p>
                <Button type="button" className="mt-3 w-full" onClick={requestMediaPermissions} disabled={requestingMediaPermission}>
                  {requestingMediaPermission ? 'Requesting access…' : 'Allow Camera & Microphone'}
                </Button>
              </div>
            )}
            {mediaPermission === 'denied' && <p className="text-xs text-amber-600">Permission was denied. Enable Camera and Microphone for MotoVeya in Android/browser settings, then try again.</p>}
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => selectMedia(e.target.files?.[0], 'photo')} />
            <input ref={videoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => selectMedia(e.target.files?.[0], 'video')} />
            <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => selectGalleryMedia(e.target.files)} />

            {mediaPreview ? (
              <>
              <div className="relative overflow-hidden rounded-2xl bg-black">
                {mediaType === 'video' ? (
                  <video src={mediaPreview} controls onLoadedMetadata={(e) => { const duration = e.currentTarget.duration || 0; setVideoDuration(duration); setVideoNeedsTrim(duration > 30); setVideoTrimStart(0); setVideoTrimEnd(Math.min(30, duration)); }} className="max-h-72 w-full object-contain" />
                ) : (
                  <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {mediaPreviews.map((preview, index) => <img key={preview} src={preview} alt={`Selected photo ${index + 1}`} className="h-72 w-full shrink-0 snap-center object-contain" />)}
                  </div>
                )}
                {mediaType === 'photo' && mediaFiles.length > 1 && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">{mediaFiles.length} photos • swipe</div>}
                <button type="button" onClick={() => { mediaPreviews.forEach((url) => URL.revokeObjectURL(url)); setMediaFile(null); setMediaFiles([]); setMediaPreview(''); setMediaPreviews([]); setVideoNeedsTrim(false); }} className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white"><X size={17} /></button>
              </div>
              {mediaType === 'video' && videoDuration > 0 && (
                <div className="mt-3 space-y-3 rounded-2xl border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-semibold">Choose your 30 seconds</p><p className="text-xs text-muted-foreground">Recommended quality: 1080p</p></div>
                    <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold">{Math.round(videoTrimEnd - videoTrimStart)}s</span>
                  </div>
                  {videoDuration > 30 ? (
                    <><p className="text-xs text-amber-600">Your video is {Math.round(videoDuration)} seconds. Drag the slider to select the section you want to share.</p><input type="range" min="0" max={Math.max(0, videoDuration - 30)} step="0.1" value={videoTrimStart} onChange={(e) => { const start = Number(e.target.value); setVideoTrimStart(start); setVideoTrimEnd(Math.min(videoDuration, start + 30)); }} className="w-full" /><div className="flex justify-between text-[11px] text-muted-foreground"><span>Start {videoTrimStart.toFixed(1)}s</span><span>End {videoTrimEnd.toFixed(1)}s</span></div></>
                  ) : <p className="text-xs text-muted-foreground">This video is within the 30-second limit.</p>}
                </div>
              )}
              </>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" className="h-24 flex-col gap-2" onClick={() => photoInputRef.current?.click()}><Camera size={24} /> Take Photo</Button>
                <Button variant="secondary" className="h-24 flex-col gap-2" onClick={async () => { if (mediaPermission !== 'granted' && !(await requestMediaPermissions())) return; videoInputRef.current?.click(); }}><Video size={24} /> Record Video</Button>
                <Button variant="secondary" className="h-24 flex-col gap-2" onClick={() => galleryInputRef.current?.click()}><Upload size={24} /> Gallery</Button>
              </div>
            )}

            {mediaType === 'photo' && mediaFiles.length > 1 && <p className="text-xs text-muted-foreground">Swipe left or right to preview your {mediaFiles.length} photos. Maximum 10 photos per post.</p>}

            <div>
              <label htmlFor="crowd-caption" className="mb-1.5 block text-sm font-medium">Caption</label>
              <Textarea id="crowd-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What did you find on the road?" rows={3} />
            </div>

            <div>
              <label htmlFor="crowd-location" className="mb-1.5 block text-sm font-medium">Add Location</label>
              <div className="flex gap-2">
                <Input id="crowd-location" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Clarens, Golden Gate" className="min-w-0" />
                <Button type="button" variant="secondary" size="icon" onClick={useCurrentLocation} title="Use current location"><LocateFixed size={18} /></Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">The location is saved with your post so it can be connected to navigation later.</p>
            </div>

            <Button className="w-full min-h-[48px]" disabled={!mediaFile || publishClip.isPending || (mediaType === 'video' && videoNeedsTrim && Math.round(videoTrimEnd - videoTrimStart) !== 30)} onClick={() => publishClip.mutate()}>
              {publishClip.isPending ? 'Publishing…' : 'Post to Crowd Clips'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!commentClip} onOpenChange={(open) => !open && setCommentClip(null)}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
          <DialogHeader><DialogTitle>Comments</DialogTitle></DialogHeader>
          <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto pr-1">
            {(commentsByClip[commentClip?.id] || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
            ) : (commentsByClip[commentClip?.id] || []).map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <img src={comment.user_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user_name || 'Rider')}`} alt="" className="h-8 w-8 rounded-full object-cover" />
                <div className="min-w-0 rounded-2xl bg-muted px-3 py-2">
                  <p className="text-xs font-semibold">{comment.user_name}</p>
                  <p className="text-sm">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (commentText.trim()) commentMutation.mutate({ clipId: commentClip.id, text: commentText }); }}>
            <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment…" />
            <Button type="submit" size="icon" disabled={!commentText.trim() || commentMutation.isPending}><Send size={17} /></Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
