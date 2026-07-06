import { UserMinus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

export default function RemoveFriendButton({ friendName = 'this friend', onConfirm }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <UserMinus className="h-3.5 w-3.5" />
          Remove friend
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {friendName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove them from your friends list. You'll stop sharing your live location and ride invites with each other. This action can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onConfirm?.()}
          >
            Remove Friend
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}