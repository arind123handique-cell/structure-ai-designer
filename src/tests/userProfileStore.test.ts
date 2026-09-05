import { describe, it, expect, beforeEach } from 'vitest';
import { useUserProfileStore } from '@/features/auth/userProfileStore';
import { findWindowDef } from '@/components/window/WindowRegistry';

describe('User Profile Store & Window Registry', () => {
  beforeEach(() => {
    useUserProfileStore.setState({
      displayName: 'Er. Arindam Handique',
      designation: 'Lead Structural Engineer',
      firmName: 'StructureAI Global Engineering',
      licenseNumber: 'ST-2026-IND-8941',
      bio: 'Specialized in IS 456 / IS 13920 RCC framing.',
      phoneNumber: '+91 98765 43210',
      location: 'Site Office',
      defaultConcreteGrade: 'M25',
      defaultSteelGrade: 'Fe500D',
      defaultSeismicZone: 'Zone V',
      autoCloudSync: true,
    });
  });

  it('initializes with default engineer profile', () => {
    const state = useUserProfileStore.getState();
    expect(state.displayName).toBe('Er. Arindam Handique');
    expect(state.designation).toBe('Lead Structural Engineer');
    expect(state.defaultConcreteGrade).toBe('M25');
  });

  it('updates engineer profile fields', () => {
    const store = useUserProfileStore.getState();
    store.updateProfile({
      displayName: 'Er. John Doe',
      designation: 'Chief Consultant',
      defaultConcreteGrade: 'M35',
    });

    const updated = useUserProfileStore.getState();
    expect(updated.displayName).toBe('Er. John Doe');
    expect(updated.designation).toBe('Chief Consultant');
    expect(updated.defaultConcreteGrade).toBe('M35');
  });

  it('registers userSettings window in WINDOW_REGISTRY', () => {
    const def = findWindowDef('userSettings');
    expect(def).toBeDefined();
    expect(def?.title).toBe('User Account & Profile Settings');
    expect(def?.category).toBe('User');
    expect(def?.singleton).toBe(true);
  });
});
