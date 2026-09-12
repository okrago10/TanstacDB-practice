import { createRoot } from 'react-dom/client'
import { bootExperiment } from './experiment.ts'
import { Lab } from './ui/lab.tsx'
import './index.css'

document.documentElement.lang = 'ja'

const experiment = bootExperiment()
const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

createRoot(root).render(<Lab experiment={experiment} />)
