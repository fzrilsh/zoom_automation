require('dotenv').config()
const Zoom = require('./main.js')

async function main() {
    console.clear()

    const zoom = new Zoom()
    await zoom.initialize()
}

main()