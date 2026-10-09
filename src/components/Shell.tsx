import { Suspense, type ComponentType, type SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { APP_NAME } from '../config'
import { copy } from '../content/copy'
import { BeanIcon, HomeIcon, LampIcon } from './icons'
import { useDaypart } from './useDaypart'

const tabs: { to: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { to: '/', label: copy.tabs.home, Icon: HomeIcon },
  { to: '/me', label: copy.tabs.myRoom, Icon: LampIcon },
  { to: '/profile', label: copy.tabs.profile, Icon: BeanIcon },
]

function TabLink({ to, label, Icon }: (typeof tabs)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold md:flex-row md:gap-3 md:text-base',
          isActive ? 'bg-accent text-on-accent' : 'text-on-nav hover:bg-white/10',
        ].join(' ')
      }
    >
      <Icon />
      <span>{label}</span>
    </NavLink>
  )
}

export function Shell() {
  useDaypart()

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-accent px-4 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {copy.common.skipToMain}
      </a>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-nav px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:static md:w-60 md:border-t-0 md:border-r-2 md:px-4 md:py-6"
      >
        <p className="font-display mb-8 hidden px-3 text-2xl font-bold text-on-nav md:block">{APP_NAME}</p>
        <ul className="flex justify-around md:flex-col md:gap-2">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <TabLink {...tab} />
            </li>
          ))}
        </ul>
      </nav>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-28 md:px-10 md:py-10"
      >
        <Suspense
          fallback={
            <p role="status" className="text-on-bg-muted">
              {copy.common.loading}
            </p>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
