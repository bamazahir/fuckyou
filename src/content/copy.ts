// Every user-facing string lives here (SPEC §16).
export const copy = {
  tabs: { home: 'Home', myRoom: 'My Room', profile: 'Profile' },
  home: {
    greeting: { day: 'Good to see you.', night: 'The lamps are on.' },
    roomsHeading: 'Your rooms',
    emptyTitle: 'No rooms yet',
    emptyBody: 'Rooms are where you study with friends. You can create one or join with a code soon.',
    createRoom: 'Create room',
    joinWithCode: 'Join with code',
    comingSoon: 'Arrives in the next update',
  },
  myRoom: {
    title: 'My Room',
    body: 'Your own little room. You will decorate it with what you earn from studying.',
  },
  profile: {
    title: 'Profile',
    lifetime: 'Lifetime',
    thisWeek: 'This week',
    streak: 'Day streak',
    privacy: 'Privacy',
  },
  notFound: { title: 'This room does not exist', back: 'Back home' },
} as const
