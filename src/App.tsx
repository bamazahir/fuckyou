import { useEffect, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Shell } from './components/Shell'
import { SignInPage } from './features/auth/SignInPage'
import { BlockedPage, LoadErrorPage, LoadingPage, UnconfiguredPage } from './features/auth/StatusPages'
import { WaitingPage } from './features/auth/WaitingPage'
import { AdminPage } from './features/admin/AdminPage'
import { ConsentPage } from './features/consent/ConsentPage'
import { InvitePage } from './features/invite/InvitePage'
import { PrivacyPage } from './features/privacy/PrivacyPage'
import { Toasts } from './components/Toasts'
import { PushSheet } from './features/push/PushSheet'
import { usePush } from './stores/push'
import { pendingInvite, useRooms } from './stores/rooms'
import { HomePage } from './features/home/HomePage'
import { MyRoomPage } from './features/myroom/MyRoomPage'
import { NotFoundPage } from './features/NotFoundPage'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { RoomPage } from './features/room/RoomPage'
import { startClockSync } from './lib/servertime'
import { supabase } from './lib/supabase'
import { useAuth, type AuthStatus } from './stores/auth'
import { useTimer } from './stores/timer'

/** Routes each auth state to the one screen it may see (SPEC §5.1, §8.2 consent gate). */
function Gate({ allow, children }: { allow: AuthStatus; children: ReactNode }) {
  const status = useAuth((s) => s.status)
  if (status === 'loading') return <LoadingPage />
  if (status === 'unconfigured') return <UnconfiguredPage />
  if (status === 'error') return <LoadErrorPage />
  if (status === allow) return <>{children}</>
  const home: Record<AuthStatus, string> = {
    loading: '/',
    unconfigured: '/',
    error: '/',
    signed_out: '/signin',
    needs_profile: '/onboarding',
    pending: '/waiting',
    ready: '/',
  }
  return <Navigate to={home[status]} replace />
}

const router = createBrowserRouter([
  {
    path: '/signin',
    element: (
      <Gate allow="signed_out">
        <SignInPage />
      </Gate>
    ),
  },
  {
    path: '/onboarding',
    element: (
      <Gate allow="needs_profile">
        <OnboardingPage />
      </Gate>
    ),
  },
  {
    path: '/waiting',
    element: (
      <Gate allow="pending">
        <WaitingPage />
      </Gate>
    ),
  },
  { path: '/blocked', element: <BlockedPage /> },
  // Public pages: no sign-in needed (invite preview, parent consent, privacy).
  { path: '/j/:code', element: <InvitePage /> },
  { path: '/consent/:token', element: <ConsentPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  {
    element: (
      <Gate allow="ready">
        <Shell />
      </Gate>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/me', element: <MyRoomPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/room/:roomId', element: <RoomPage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function App() {
  const status = useAuth((s) => s.status)

  useEffect(() => {
    useAuth.getState().init()
  }, [])

  useEffect(() => {
    if (status !== 'ready') return
    startClockSync()
    void useTimer.getState().loadActive()
    void useRooms.getState().loadBlocks()
    const uid = useAuth.getState().profile?.id
    if (uid)
      void usePush
        .getState()
        .claimDevice(uid)
        .then(() => usePush.getState().refresh())
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    void supabase.rpc('log_event', { p_name: 'app_open', p_props: { standalone } })
    // Finish an invite that was opened before signing in.
    const code = pendingInvite.get()
    if (code) {
      pendingInvite.clear()
      void useRooms
        .getState()
        .join(code)
        .then((res) => {
          if (res.id) void router.navigate(`/room/${res.id}`)
        })
    }
  }, [status])

  return (
    <>
      <RouterProvider router={router} />
      <Toasts />
      {status === 'ready' && <PushSheet />}
    </>
  )
}
