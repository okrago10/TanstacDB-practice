/** @vitest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { bootExperiment } from './experiment.ts'
import { Lab } from './ui/lab.tsx'

it('loads both panes and removes a todo from the db list on 完了', async () => {
  const experiment = bootExperiment()
  experiment.network.setLatency(0)
  render(<Lab experiment={experiment} />)
  const dbPane = await screen.findByRole('region', { name: 'TanStack DB' })
  const naivePane = screen.getByRole('region', {
    name: 'useState / useMemo / await',
  })
  const dbCount = await within(dbPane).findByText(/件中/, undefined, {
    timeout: 8000,
  })
  const naiveCount = await within(naivePane).findByText(/件中/, undefined, {
    timeout: 8000,
  })
  expect(dbCount.textContent).toBe(naiveCount.textContent)
  expect(dbCount.textContent).toMatch(/^\d+ 件中 \d+ 件を表示$/)
  const complete = within(dbPane).getAllByRole('button', { name: '完了' })[0]
  expect(complete).toBeDefined()
  const before = dbCount.textContent
  await userEvent.click(complete!)
  await waitFor(() => {
    expect(within(dbPane).getByText(/件中/).textContent).not.toBe(before)
  })
  expect(within(naivePane).getByText(/件中/).textContent).toBe(before)
})
