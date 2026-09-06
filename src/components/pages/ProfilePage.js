import React from 'react';
import { useApp } from '../../context/AppContext';
import ProfileSetupScreen from '../ProfileSetupScreen';

export default function ProfilePage() {
  const { authUser, profile, setProfile, showToast, onSignOut } = useApp();

  if (!authUser) return null;

  return (
    <ProfileSetupScreen
      user={authUser}
      initialProfile={profile}
      editing
      onSignOut={onSignOut}
      onComplete={(saved) => {
        setProfile(saved);
        showToast('Profile saved.', 'success');
      }}
    />
  );
}
