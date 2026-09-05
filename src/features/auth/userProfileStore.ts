import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProfileData {
  displayName: string;
  designation: string;
  firmName: string;
  licenseNumber: string;
  bio: string;
  phoneNumber: string;
  location: string;
  defaultConcreteGrade: string;
  defaultSteelGrade: string;
  defaultSeismicZone: string;
  autoCloudSync: boolean;
}

interface UserProfileState extends UserProfileData {
  updateProfile: (updates: Partial<UserProfileData>) => void;
}

export const useUserProfileStore = create<UserProfileState>()(
  persist(
    (set) => ({
      displayName: 'Er. Arindam Handique',
      designation: 'Lead Structural Engineer',
      firmName: 'StructureAI Global Engineering',
      licenseNumber: 'ST-2026-IND-8941',
      bio: 'Specialized in IS 456 / IS 13920 RCC framing, 3D space frame analysis, and deep foundation design.',
      phoneNumber: '+91 98765 43210',
      location: '6 Miles Site Office, Phase II',
      defaultConcreteGrade: 'M25',
      defaultSteelGrade: 'Fe500D',
      defaultSeismicZone: 'Zone V',
      autoCloudSync: true,

      updateProfile: (updates) => set((state) => ({ ...state, ...updates })),
    }),
    {
      name: 'app:user-profile',
    }
  )
);
