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
  UserPlus, UserCheck, Upload, Video, X, LocateFixed
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState('photo');
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState(null);
  const [commentClip, setCommentClip] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [following, setFollowing] = useState(new Set());

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
      else await base44.entities.CrowdClipLike.create({ clip_id: clip.id, user_id: user.id });
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
      else await base44.entities.CrowdClipFollow.create({ creator_id: creatorId, follower_id: user.id, creator_name: creatorName });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['crowd-clips'] }),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ clipId, text }) => base44.entities.CrowdClipComment.create({
      clip_id: clipId,
      user_id: user.id,
      user_name: user.nickname || user.full_name || 'Rider',
      user_avatar_url: user.avatar_url || '',
      text: text.trim(),
    }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['crowd-clips'] });
    },
  });

  const resetComposer = () => {
    setComposerOpen(false);
    setMediaFile(null);
    setMediaPreview('');
    setMediaType('photo');
    setCaption('');
    setLocationName('');
    setLocationCoords(null);
  };

  const selectMedia = (file, type) => {
    if (!file) return;
    if (!file.type.startsWith(type === 'video' ? 'video/' : 'image/')) {
      toast.error(`Please select a ${type}.`);
      return;
    }
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
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

  const publishClip = useMutation({
    mutationFn: async () => {
      if (!mediaFile) throw new Error('Choose a photo or video first.');
      const { file_url } = await base44.integrations.Core.UploadFile({ file: mediaFile });
      return base44.entities.CrowdClip.create({
        media_type: mediaType,
        media_url: file_url,
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
    <div className="min-h-screen bg-background pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clapperboard size={22} className="text-primary" />
              <h1 className="text-xl font-bold">Crowd Clips</h1>
            </div>
            <p className="text-xs text-muted-foreground">Ride. Capture. Share.</p>
          </div>
          <Button size="icon" className="rounded-full" onClick={() => setComposerOpen(true)} aria-label="Create Crowd Clip">
            <Plus size={21} />
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-3 py-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => <div key={n} className="aspect-[9/14] animate-pulse rounded-3xl bg-muted" />)}
          </div>
        ) : clips.length === 0 ? (
          <div className="flex min-h-[65vh] flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-5 text-primary"><Clapperboard size={42} /></div>
            <h2 className="text-xl font-bold">Be the first on Crowd Clips</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">Share your ride, your bike, a great road or a place other riders need to see.</p>
            <Button className="mt-5" onClick={() => setComposerOpen(true)}><Camera size={18} className="mr-2" /> Create a Clip</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {clips.map((clip) => {
              const liked = likeSet.has(clip.id);
              const isFollowing = following.has(clip.creator_id) || clip.creator_id === user.id;
              const clipComments = commentsByClip[clip.id] || [];
              const clipLikes = likesByClip[clip.id] || [];
              return (
                <article key={clip.id} className="overflow-hidden rounded-3xl border border-border bg-card">
                  <div className="relative bg-black">
                    {clip.media_type === 'video' ? (
                      <video src={clip.media_url} controls playsInline preload="metadata" className="block max-h-[72vh] min-h-[420px] w-full object-contain" />
                    ) : (
                      <img src={clip.media_url} alt={clip.caption || 'Crowd Clip'} className="block max-h-[72vh] min-h-[420px] w-full object-contain" />
                    )}
                    {clip.location_name && (
                      <div className="absolute bottom-3 left-3 flex max-w-[80%] items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                        <MapPin size={13} /> <span className="truncate">{clip.location_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={avatarFor(clip)} alt="" className="h-10 w-10 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{clip.creator_name}</p>
                        <p className="text-xs text-muted-foreground">MotoVeya rider</p>
                      </div>
                      {clip.creator_id !== user.id && (
                        <Button
                          variant={isFollowing ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => followMutation.mutate({ creatorId: clip.creator_id, creatorName: clip.creator_name })}
                        >
                          {isFollowing ? <UserCheck size={15} className="mr-1" /> : <UserPlus size={15} className="mr-1" />}
                          {isFollowing ? 'Following' : 'Follow'}
                        </Button>
                      )}
                    </div>

                    {clip.caption && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{clip.caption}</p>}

                    <div className="mt-4 flex items-center gap-2">
                      <Button variant="ghost" size="sm" className={`rounded-full ${liked ? 'text-red-500' : ''}`} onClick={() => toggleLike.mutate(clip)}>
                        <Heart size={19} className="mr-1.5" fill={liked ? 'currentColor' : 'none'} /> {clipLikes.length}
                      </Button>
                      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setCommentClip(clip)}>
                        <MessageCircle size={19} className="mr-1.5" /> {clipComments.length}
                      </Button>
                      {clip.location_lat != null && clip.location_lng != null && (
                        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={14} /> Location saved</span>
                      )}
                    </div>
                  </div>
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
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => selectMedia(e.target.files?.[0], 'photo')} />
            <input ref={videoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => selectMedia(e.target.files?.[0], 'video')} />

            {mediaPreview ? (
              <div className="relative overflow-hidden rounded-2xl bg-black">
                {mediaType === 'video' ? <video src={mediaPreview} controls className="max-h-72 w-full object-contain" /> : <img src={mediaPreview} alt="Selected clip" className="max-h-72 w-full object-contain" />}
                <button type="button" onClick={() => { setMediaFile(null); setMediaPreview(''); }} className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white"><X size={17} /></button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" className="h-24 flex-col gap-2" onClick={() => photoInputRef.current?.click()}><Camera size={24} /> Take Photo</Button>
                <Button variant="secondary" className="h-24 flex-col gap-2" onClick={() => videoInputRef.current?.click()}><Video size={24} /> Record Video</Button>
                <Button variant="secondary" className="h-24 flex-col gap-2" onClick={() => { setMediaType('photo'); photoInputRef.current?.click(); }}><Upload size={24} /> Upload</Button>
              </div>
            )}

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

            <Button className="w-full min-h-[48px]" disabled={!mediaFile || publishClip.isPending} onClick={() => publishClip.mutate()}>
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
