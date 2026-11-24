import { useState } from 'react';
import { getProfileAvatarUrl } from './TaskRowUtils';

export default function TaskOwnerAvatar({ owner, className = 'backlog-owner-initial-avatar' }) {
  const imageUrl = getProfileAvatarUrl(owner);
  const [failedImageUrl, setFailedImageUrl] = useState('');
  const initials =
    owner?.initial ||
    owner?.initials ||
    owner?.name?.slice(0, 1)?.toUpperCase() ||
    'U';
  const backgroundColor = owner?.avatarBg || owner?.avatarColor || '#6366f1';

  if (imageUrl && failedImageUrl !== imageUrl) {
    return (
      <img
        className={`${className} task-owner-avatar-image`}
        src={imageUrl}
        alt=""
        title={owner?.name || ''}
        style={{ backgroundColor }}
        onError={() => setFailedImageUrl(imageUrl)}
      />
    );
  }

  return (
    <div className={className} style={{ backgroundColor }}>
      {initials}
    </div>
  );
}
