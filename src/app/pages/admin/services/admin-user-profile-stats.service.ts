/* istanbul ignore file */
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { combineLatest, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

type Gender = 'unspecified' | 'male' | 'female' | 'diverse';

export type AdminUserProfileStats = {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  bannedUsers: number;
  deletedUsers: number;
  adminUsers: number;

  withFirstName: number;
  withLastName: number;
  withPhone: number;
  withPhoto: number;
  withBirthday: number;
  withBio: number;
  withWebsite: number;
  withLocation: number;
  withAnySocials: number;

  visibilityShowBio: number;
  visibilityShowWebsite: number;
  visibilityShowLocation: number;
  visibilityShowSocials: number;

  gender: { male: number; female: number; diverse: number; unspecified: number };

  public: {
    bio: number;
    website: number;
    location: number;
    socials: number;
  };

  friends: {
    withFriends: number;
    totalFriendRefs: number;
  };
};

@Injectable({ providedIn: 'root' })
export class AdminUserProfileStatsService {
  private firestore = inject(Firestore);

  private users$ = collectionData(collection(this.firestore, 'users') as any, { idField: 'uid' }) as Observable<any[]>;
  private profiles$ = collectionData(collection(this.firestore, 'profiles_public') as any, { idField: 'uid' }) as Observable<any[]>;
  private bans$ = collectionData(collection(this.firestore, 'banlist') as any, { idField: 'uid' }) as Observable<any[]>;
  private admins$ = collectionData(collection(this.firestore, 'admins') as any, { idField: 'uid' }) as Observable<any[]>;

  readonly stats$: Observable<AdminUserProfileStats> = combineLatest([
    this.users$,
    this.profiles$,
    this.bans$,
    this.admins$,
  ]).pipe(
    map(([users, profiles, bans, admins]) => {
      const hasStr = (v: any) => typeof v === 'string' && v.trim().length > 0;
      const truthyArr = (v: any) => Array.isArray(v) && v.length > 0;

      const banMap = new Map<string, any>();
      for (const b of bans ?? []) banMap.set(String(b.uid), b);
      const adminSet = new Set<string>((admins ?? []).map((a: any) => String(a.uid)));

      let activeUsers = 0;
      let lockedUsers = 0;
      let bannedUsers = 0;
      let deletedUsers = 0;

      let withFirstName = 0;
      let withLastName = 0;
      let withPhone = 0;
      let withPhoto = 0;
      let withBirthday = 0;
      let withBio = 0;
      let withWebsite = 0;
      let withLocation = 0;
      let withAnySocials = 0;

      let visibilityShowBio = 0;
      let visibilityShowWebsite = 0;
      let visibilityShowLocation = 0;
      let visibilityShowSocials = 0;

      let gMale = 0;
      let gFemale = 0;
      let gDiverse = 0;
      let gUnspec = 0;

      let withFriends = 0;
      let totalFriendRefs = 0;

      for (const u of users ?? []) {
        const uid = String(u.uid);
        const deletedAt = u?.status?.deletedAt ?? null;
        const ban = banMap.get(uid);

        if (deletedAt) {
          deletedUsers++;
        } else if (ban?.type === 'ban') {
          bannedUsers++;
        } else if (ban?.type === 'lock') {
          lockedUsers++;
        } else {
          activeUsers++;
        }

        const p = u?.profile ?? {};
        const loc = p?.location ?? {};
        const socials = p?.socials ?? {};
        const vis = p?.visibility ?? {};

        if (hasStr(p.firstName)) withFirstName++;
        if (hasStr(p.lastName)) withLastName++;
        if (hasStr(p.phoneNumber) || hasStr(u.phoneNumber)) withPhone++;
        if (hasStr(p.photoURL) || hasStr(u.photoURL)) withPhoto++;
        if (hasStr(p.birthday)) withBirthday++;
        if (hasStr(p.bio)) withBio++;
        if (hasStr(p.website)) withWebsite++;
        if (hasStr(loc.city) || hasStr(loc.country)) withLocation++;

        const anySocial = Object.values(socials).some((v) => hasStr(v));
        if (anySocial) withAnySocials++;

        if (vis.showBio !== false) visibilityShowBio++;
        if (vis.showWebsite !== false) visibilityShowWebsite++;
        if (vis.showLocation !== false) visibilityShowLocation++;
        if (vis.showSocials !== false) visibilityShowSocials++;

        const gender: Gender =
          p.gender === 'male' || p.gender === 'female' || p.gender === 'diverse'
            ? p.gender
            : 'unspecified';
        if (gender === 'male') gMale++;
        else if (gender === 'female') gFemale++;
        else if (gender === 'diverse') gDiverse++;
        else gUnspec++;

        if (truthyArr(u.friends)) {
          withFriends++;
          totalFriendRefs += u.friends.length;
        }
      }

      // Public profile counts (sichtbar nach Privacy + Sync)
      let publicBio = 0;
      let publicWebsite = 0;
      let publicLocation = 0;
      let publicSocials = 0;
      for (const p of profiles ?? []) {
        if (hasStr(p.bio)) publicBio++;
        if (hasStr(p.website)) publicWebsite++;
        if (hasStr(p.locationText)) publicLocation++;
        const socials = p.socials ?? null;
        const anySocial = socials && typeof socials === 'object' && Object.values(socials).some((v) => hasStr(v));
        if (anySocial) publicSocials++;
      }

      return {
        totalUsers: (users ?? []).length,
        activeUsers,
        lockedUsers,
        bannedUsers,
        deletedUsers,
        adminUsers: adminSet.size,

        withFirstName,
        withLastName,
        withPhone,
        withPhoto,
        withBirthday,
        withBio,
        withWebsite,
        withLocation,
        withAnySocials,

        visibilityShowBio,
        visibilityShowWebsite,
        visibilityShowLocation,
        visibilityShowSocials,

        gender: { male: gMale, female: gFemale, diverse: gDiverse, unspecified: gUnspec },

        public: {
          bio: publicBio,
          website: publicWebsite,
          location: publicLocation,
          socials: publicSocials,
        },

        friends: {
          withFriends,
          totalFriendRefs,
        },
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}
