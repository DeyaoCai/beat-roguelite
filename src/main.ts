import './style.css'
import { boot } from './app/boot'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

boot(app)
