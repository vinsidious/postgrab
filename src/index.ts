import { App } from './app'

new App()
    .initialize()
    .then((app) => app.run())
    .then(() => process.exit())
