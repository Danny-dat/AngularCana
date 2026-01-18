/* istanbul ignore file */
export type AvatarPreset = {
  id: string;
  label: string;
  /** Path under /src/assets */
  path: string;
};

/**
 * Spark Plan: kein Firebase Storage.
 * Deshalb nutzen wir Avatar-Presets aus dem /assets Ordner.
 */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'a01', label: 'Avatar 1', path: 'assets/avatars/avatar-01.svg' },
  { id: 'a02', label: 'Avatar 2', path: 'assets/avatars/avatar-02.svg' },
  { id: 'a03', label: 'Avatar 3', path: 'assets/avatars/avatar-03.svg' },
  { id: 'a04', label: 'Avatar 4', path: 'assets/avatars/avatar-04.svg' },
  { id: 'a05', label: 'Avatar 5', path: 'assets/avatars/avatar-05.svg' },
  { id: 'a06', label: 'Avatar 6', path: 'assets/avatars/avatar-06.svg' },
  { id: 'a07', label: 'Avatar 7', path: 'assets/avatars/avatar-07.svg' },
  { id: 'a08', label: 'Avatar 8', path: 'assets/avatars/avatar-08.svg' },
];
