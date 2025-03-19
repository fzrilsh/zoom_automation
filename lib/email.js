const { default: axios } = require("axios")
const path = require('path')
const fs = require('fs')

const firstNames = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../assets/first_name.json')))
const lastNames = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../assets/last_name.json')))

class Email {
    constructor() {
        this.firstName = null
        this.lastName = null

        this.username = null
        this.email = null
        this.password = null

        this.axios = axios.create({
            baseURL: `https://${process.env.MAIL_HOST_DOMAIN}:2083/execute/Email`,
            headers: {
                "Authorization": `cpanel ${process.env.MAIL_HOST_USER}:${process.env.MAIL_HOST_TOKEN}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        })
    }

    /**
     * 
     * @param {Number} min 
     * @param {Number} max 
     * @returns {Number} random integer
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min) + min)
    }

    /**
     * 
     * @returns {String} password
     */
    generatePassword() {
        const length = 12
        const charset = "@#$&*0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$&*0123456789abcdefghijklmnopqrstuvwxyz"
        let password = ""

        for (var i = 0, n = charset.length; i < length; ++i) {
            password += charset.charAt(Math.floor(Math.random() * n))
        }

        return password
    }

    async make(){
        this.firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
        this.lastName = lastNames[Math.floor(Math.random() * lastNames.length)]

        this.username = `${this.firstName.toLowerCase()}.${this.lastName.toLowerCase()}${this.randomInt(0, 999999).toString().padStart(5, '0')}`
        this.email = `${this.username}@${process.env.MAIL_HOST_DOMAIN}`
        this.password = this.generatePassword()

        let response = await this.axios.post('/add_pop', new URLSearchParams({
            email: this.username,
            password: this.password,
            domain: process.env.MAIL_HOST_DOMAIN,
            quota: 1,
        }))

        return response.data
    }

    async remove(){
        let response = await this.axios.post('/delete_pop', new URLSearchParams({
            email: this.username,
            domain: process.env.MAIL_HOST_DOMAIN,
        }))

        return response.data
    }
}

module.exports = Email