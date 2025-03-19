const { default: puppeteer } = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

const Email = require('./lib/email.js')
const Imap = require("imap")
const { simpleParser } = require("mailparser")

/**
 * 
 * @param {Number} timer 
 * @returns {Promise}
 */
const delay = async (timer) => await new Promise(r => setTimeout(r, timer))

class Zoom {
    constructor() {
        this.mail = null
        this.zoomPassword = 'SecurePassword123!!'
        
        this.browser = null
        this.page = null
        this.imap = null
    }

    async initialize() {
        console.clear()

        console.log('Creating mail account...')
        this.mail = new Email()
        await this.mail.make()

        this.imap = new Imap({
            user: this.mail.email,
            password: this.mail.password,
            host: `mail.${process.env.MAIL_HOST_DOMAIN}`,
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
        })
        this.imap.connect()

        puppeteer.use(StealthPlugin())
        this.browser = await puppeteer.launch({
            headless: "new",
            args: ['--window-size=1200,800', '--no-sandbox', '--disable-setuid-sandbox'] 
        })

        this.page = await this.browser.newPage()
        this.page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36")

        return await this.createZoomAccount()
    }

    async errorHandler(error){
        console.error(`Error occured:`, error.toString())

        await this.mail.remove()
    }

    async createZoomAccount() {
        try {
            console.log('Go to zoom signup page...')
            await this.page.goto('https://www.zoom.us/signup')

            if (await this.page.$('#OPT-ZTSPZ-370__BirthYear-input')) {
                await this.page.click('#OPT-ZTSPZ-370__BirthYear-input')
                await this.page.type('#OPT-ZTSPZ-370__BirthYear-input', '2004')

                await this.page.click('#email')
                await this.page.type('#email', this.mail.email, { delay: 100 })

                await this.page.click('.OPT-ZTSPZ-370__ContinueButton')
            }

            if (await this.page.$('#year')) {
                await this.page.click('#year')
                await this.page.type('#year', '2004', { delay: 100 })

                await this.page.click('.btn-block')
                await this.page.waitForSelector('#email')
            }

            if (await this.page.$eval('#email', (el) => !el.value)) {
                await this.page.click('#email')
                await this.page.type('#email', this.mail.email, { delay: 100 })

                await this.page.click('.btn-block')
            }

            await this.getNfillOTP()
        } catch (error) {
            await this.errorHandler(error)
        }
    }

    async getNfillOTP() {
        try {
            console.log('Success creating new zoom account, now waiting for OTP code...')
            await this.page.waitForSelector('.zm-pin-code__input')

            let OTP_Grained = false
            let OTP_Code = null
            while (!OTP_Grained) {
                OTP_Code = await new Promise((resolve, reject) => {
                    this.imap.openBox("INBOX", true, (err, box) => {
                        if (err) {
                            this.imap.connect()
                            return resolve(null)
                        }

                        const searchCriteria = [
                            ["FROM", "no-reply@zoom.us"],
                            ["SINCE", new Date(Date.now() - 3 * 10 * 60 * 1000)],
                        ]
                        const fetchOptions = { bodies: ["HEADER", "TEXT"], markSeen: false }

                        this.imap.search(searchCriteria, (err, results) => {
                            if (err || !results.length) return resolve(null)

                            const fetch = this.imap.fetch(results, fetchOptions)
                            fetch.on("message", (msg) => {
                                msg.on("body", (stream) => {
                                    simpleParser(stream, (err, parsed) => {
                                        if (err || !parsed.subject) return

                                        const match = parsed.subject.match(/(\d{6})/)
                                        if (match) resolve(match[1])
                                    })
                                })
                            })
                        })
                    })
                })

                if (OTP_Code) {
                    console.log('OTP Grained...')
                    OTP_Grained = true
                    break
                }

                console.count('Attempting to get OTP Code')
                await delay(10000)
            }

            await this.page.click('.zm-pin-code__input')
            await this.page.type('.zm-pin-code__input', OTP_Code, { delay: 100 })

            await this.page.click('.btn-block')
            await this.fillingAccountDetail()
        } catch (error) {
            await this.errorHandler(error)
        }
    }

    async fillingAccountDetail() {
        try {
            console.log('Filling personal information...')
            await this.page.waitForSelector('#firstName')

            await this.page.click('#firstName');
            await this.page.type('#firstName', this.mail.firstName, { delay: 100 });

            await this.page.click('#lastName');
            await this.page.type('#lastName', this.mail.lastName, { delay: 100 });

            await this.page.click('[type="password"]')
            await this.page.type('[type="password"]', this.zoomPassword, { delay: 100 })

            if (await this.page.$('#OPT-ZTSPZ-370__BirthYear-input')) {
                await this.page.click('#OPT-ZTSPZ-370__BirthYear-input')
                await this.page.type('#OPT-ZTSPZ-370__BirthYear-input', '2004', { delay: 100 })

                await this.page.click('.OPT-ZTSPZ-370__ContinueButton')
            } else {
                await this.page.click('.btn-block')
            }

            return await this.registerToTrialAccount()
        } catch (error) {
            await this.errorHandler(error)
        }
    }

    async registerToTrialAccount() {
        try {
            console.log('Registering to zoom workplace pro 14 day...')
            await this.page.waitForSelector('[aria-label="Start Free Trial"]')
            await this.page.click('[aria-label="Start Free Trial"]')

            await this.page.waitForSelector('#zm-radio-group0-radio-0', { timeout: 120000 })
            await this.page.click(`#zm-radio-group0-radio-1`)
            await this.page.click('.opc-btn-continue')

            await this.page.waitForSelector('#addr-zip', { visible: true })
            await this.page.click('#addr-zip')
            await this.page.type('#addr-zip', '50241', { delay: 100 })

            await this.page.click('#addr-city')
            await this.page.type('#addr-city', 'Semarang', { delay: 100 })

            await this.page.click('#addr-state')
            await this.page.type('#addr-state', 'Jawa Tengah', { delay: 100 })

            await this.page.click('[for="addr-country"] ~ input')
            await this.page.type('[for="addr-country"] ~ input', 'Indonesia', { delay: 100 })
            await this.page.click('#select-item-select-1-101')
            
            await this.page.click('input[aria-label="street address *"]');
            await this.page.type('input[aria-label="street address *"]', 'Jl. Diponegoro No.123', { delay: 100 })

            await this.page.click('.opc-addr__btn .zm-button--primary.zm-button--large')
            return this.applyCreditCard()
        } catch (error) {
            await this.errorHandler(error)
        }
    }

    async applyCreditCard(){
        try {
            console.log('Applying debit card...')
            await delay(2000)

            await this.page.waitForSelector('input[value="CreditCard"]', { visible: true })
            await this.page.click('input[value="CreditCard"]')
            await this.page.click('input[value="CreditCard"]')

            await this.page.waitForSelector('#z_hppm_iframe')
            const iframeElement = await this.page.$('#z_hppm_iframe')
            const frame = await iframeElement.contentFrame()

            await frame.waitForSelector('#input-creditCardNumber')
            await frame.type('#input-creditCardNumber', process.env.CREDIT_CARD_NUMBER, { delay: 100 })
            await frame.type('#input-cardSecurityCode', process.env.CARD_SECURITY_CODE, { delay: 100 })

            await frame.select('#input-creditCardExpirationMonth', process.env.CREDIT_CARD_EXPIRATION_MONTH)
            await frame.select('#input-creditCardExpirationYear', process.env.CREDIT_CARD_EXPIRATION_YEAR)

            await this.page.click('.opc-payment-credit__action button')
            await delay(5000)
            await this.page.click('.opc__submit-action button')

            await this.page.waitForNavigation()
            await this.changeZoomSetting()
        } catch (error) {
            await this.errorHandler(error)
        }
    }

    async changeZoomSetting(){
        try {
            console.log('Change some zoom security settings...')
            await this.page.goto('https://us05web.zoom.us/account/setting/security?ampDeviceId=904c8c21-5215-429e-8657-095d31f7d7c6&ampSessionId=1742370750857')

            await this.page.waitForSelector('[aria-label="One-Time Passcode Authentication"]')
            await this.page.click('[aria-label="One-Time Passcode Authentication"]')

            await delay(5000)
            await this.finish()
        } catch (error) {
            await this.errorHandler(error)
        }
    }

    async finish(){
        console.clear()
        console.log(`Login: https://www.zoom.us/signin#/login\nEmail: ${this.mail.email}\nPassword: ${this.zoomPassword}\n\n14 Day Zoom Workplace Free Trial.`)
    }
}

module.exports = Zoom