import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

/**
 * Stands in for MainApp's nav-tab pattern (Task 4, Step 3): a button that
 * calls navigate() and a section that renders based on useLocation().
 * Exercises the exact mechanism App.tsx now uses, without needing to mock
 * AuthContext/useExercises/useStats just to render the real MainApp.
 */
function NavTabsFixture() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div>
      <button onClick={() => navigate('/')}>Home</button>
      <button onClick={() => navigate('/progress')}>Progress</button>
      {location.pathname === '/' && <p>Home section</p>}
      {location.pathname === '/progress' && <p>Progress section</p>}
    </div>
  )
}

describe('nav-tab routing pattern', () => {
  test('starts on the home section for the root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/*" element={<NavTabsFixture />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Home section')).toBeInTheDocument()
    expect(screen.queryByText('Progress section')).not.toBeInTheDocument()
  })

  test('clicking the Progress tab swaps the visible section without unmounting the component', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/*" element={<NavTabsFixture />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: 'Progress' }))

    expect(screen.getByText('Progress section')).toBeInTheDocument()
    expect(screen.queryByText('Home section')).not.toBeInTheDocument()
  })

  test('clicking Home from Progress returns to the home section', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/progress']}>
        <Routes>
          <Route path="/*" element={<NavTabsFixture />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Progress section')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))

    expect(screen.getByText('Home section')).toBeInTheDocument()
    expect(screen.queryByText('Progress section')).not.toBeInTheDocument()
  })
})
