import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Shell } from './components/Shell'
import { HomePage } from './features/home/HomePage'
import { MyRoomPage } from './features/myroom/MyRoomPage'
import { NotFoundPage } from './features/NotFoundPage'
import { ProfilePage } from './features/profile/ProfilePage'

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/me', element: <MyRoomPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
