import React, {useEffect, useState} from 'react';
import {WorkspaceAuthError} from '../utils/googleSheets';
import {
  fetchDriveImageObjectUrl,
  getCachedDriveImageUrl,
} from '../utils/googleDriveMedia';

interface DrivePhotoProps {
  driveFileId?: string | null;
  fallbackUrl?: string | null;
  workspaceToken: string | null;
  alt: string;
  className?: string;
  onAuthExpired?: () => void;
  fallback?: React.ReactNode;
}

export const DrivePhoto: React.FC<DrivePhotoProps> = ({
  driveFileId,
  fallbackUrl,
  workspaceToken,
  alt,
  className = 'w-full h-full object-cover',
  onAuthExpired,
  fallback,
}) => {
  const [driveUrl, setDriveUrl] = useState<string | null>(() =>
    driveFileId ? getCachedDriveImageUrl(driveFileId) : null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!driveFileId) {
      setDriveUrl(null);
      return;
    }

    const cached = getCachedDriveImageUrl(driveFileId);
    if (cached) {
      setDriveUrl(cached);
      return;
    }

    if (!workspaceToken) {
      setDriveUrl(null);
      return;
    }

    let cancelled = false;
    void fetchDriveImageObjectUrl(workspaceToken, driveFileId)
      .then((url) => {
        if (!cancelled) {
          setDriveUrl(url);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof WorkspaceAuthError) {
          onAuthExpired?.();
        }
        setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [driveFileId, workspaceToken, onAuthExpired]);

  const src = driveUrl || fallbackUrl || null;

  if (!src || (failed && !fallbackUrl)) {
    return <>{fallback ?? null}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (driveUrl && fallbackUrl) {
          setDriveUrl(null);
        } else {
          setFailed(true);
        }
      }}
      className={className}
    />
  );
};
