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

        this.accountID = ''
        this.clientID = ''
        this.clientSecret = ''

        this.browser = null
        this.page = null
        this.imap = null
    }

    async initialize() {
        console.clear()
        console.time('Starting process at')

        console.log('Creating mail account...')
        this.mail = new Email()
        await this.mail.make()

        this.imap = new Imap({
            user: this.mail.email,
            password: this.mail.password,
            host: `mail.${process.env.MAIL_HOST_DOMAIN}`,
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        })
        this.imap.connect()

        this.imap.on('error', (e) => {
            this.errorHandler(e)
        })

        puppeteer.use(StealthPlugin())
        this.browser = await puppeteer.launch({
            // executablePath: '/usr/bin/google-chrome',
            headless: false,
            args: [
                '--window-size=1200,800',
                '--no-sandbox',
                // '--disable-setuid-sandbox',
                // "--disable-gpu", 
                // "--disable-dev-shm-usage",
                // "--disable-extensions",
                // "--disable-background-networking",
                // "--disable-software-rasterizer",
                // "--disable-default-apps",
                // "--disable-sync",
                // "--no-first-run",
                // '--proxy-server=43.135.153.235:13001'
            ]
        })

        this.page = await this.browser.newPage()
        this.page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36")

        return await this.createZoomAccount()
    }

    async errorHandler(error) {
        console.error(`Error occured:`, error.toString())

        await this.mail.remove()
        // process.exit(1)
    }

    async createZoomAccount() {
        try {
            console.log('Go to zoom signup page...')
            await this.page.goto('https://www.zoom.us/signup', { waitUntil: 'load' })

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

    async applyCreditCard() {
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

            // recursive function for check if captcha error
            let verifyCard = async() => {
                await this.page.click('.opc-payment-credit__action button')
                await delay(5000)

                // if(await this.page.$('.zm-alert--error')){
                //     await delay(10000)
                //     return await verifyCard()
                // }

                return true
            }
            await verifyCard()
            
            await this.page.click('.opc__submit-action button')
            await this.page.waitForNavigation()

            await this.changeZoomSetting()
        } catch (error) {
            await this.errorHandler(error)
        }
    }

    async changeZoomSetting() {
        try {
            console.log('Change some zoom security settings...')
            await this.page.goto('https://us05web.zoom.us/account/setting/security?ampDeviceId=904c8c21-5215-429e-8657-095d31f7d7c6&ampSessionId=1742370750857')

            await this.page.waitForSelector('[aria-label="One-Time Passcode Authentication"]')
            await this.page.click('[aria-label="One-Time Passcode Authentication"]')

            await delay(1000)
            await this.buildApp()
        } catch (error) {
            await this.errorHandler(error)
        }
    }

    async buildApp() {
        try {
            console.log('Build app...')
            await this.page.goto('https://marketplace.zoom.us')

            await this.page.waitForSelector('[role="dialog"] button')
            await this.page.click('[role="dialog"] button')

            await this.page.goto('https://marketplace.zoom.us')
            await this.page.waitForSelector('[data-ta="develop"]')

            if(await this.page.$('[role="dialog"] button')){
                await this.page.click('[role="dialog"] button')
            }
            
            await this.page.hover('[data-ta="develop"]')
            await this.page.click('[data-ta="build-app"]')

            await this.page.click('[role="dialog"] button')
            await this.page.waitForSelector('.PrivateSwitchBase-input[value=""]')

            const radios = await this.page.$$('.PrivateSwitchBase-input[value=""]')
            await radios[1].click()

            await delay(1000)
            await this.page.click('.MuiStack-root button')

            await this.page.waitForSelector('[name="name"]')
            await this.page.type('[name="name"]', 'private-api', { delay: 100 })

            await this.page.click('.MuiStack-root button')

            await this.page.waitForSelector('[name="devClientId"]')

            const [accountID, clientID, clientSecret] = await this.page.evaluate(() =>
                ['devAccountId', 'devClientId', 'devClientSecret'].map(name => document.querySelector(`[name="${name}"]`)?.value || '')
            );

            this.accountID = accountID
            this.clientID = clientID
            this.clientSecret = clientSecret

            await this.page.click('[data-ta="continue-button"]')
            await this.page.waitForSelector('[name="description"]')

            await this.page.type('[name="description"]', 'my private API', { delay: 100 })
            await this.page.type('[name="companyName"]', 'hengker-s', { delay: 100 })
            await this.page.type('[name="contactName"]', 'aku hengker-s', { delay: 100 })
            await this.page.type('[name="contactEmail"]', this.mail.email, { delay: 100 })

            await this.page.click('[data-ta="continue-button"]')
            await this.page.waitForSelector('[data-ta="signing-secret"]')

            await this.page.click('[data-ta="continue-button"]')
            await this.page.waitForSelector('.content-between ._remote-component-container button')

            await this.page.click('.content-between ._remote-component-container button')
            await this.page.waitForSelector('.MuiButtonBase-root.MuiTab-root.MuiTab-textColorPrimary.css-1pwi56b')

            const scopes = await this.page.$$('.MuiButtonBase-root.MuiTab-root.MuiTab-textColorPrimary.css-1pwi56b')

            await scopes[17].click()
            await this.page.click('.PrivateSwitchBase-input')

            await scopes[23].click()
            await this.page.click('.PrivateSwitchBase-input')

            await this.page.click('[role="dialog"] button.MuiButton-primary')
            await this.page.waitForSelector('[data-ta="continue-button"]')
            
            await this.page.click('[data-ta="continue-button"]')
            await this.page.waitForSelector('[data-ta="activeAppBtn"]')

            await this.page.click('[data-ta="activeAppBtn"]')
            await this.page.waitForSelector('[data-ta="deactiveAppBtn"]')

            await this.finish()
        } catch (error) {
            await this.errorHandler(error)
        }
    }

    async finish() {
        console.clear()
        // console.timeEnd('Process ended at')
        console.log(`Login: https://www.zoom.us/signin#/login\nEmail: ${this.mail.email}\nPassword: ${this.zoomPassword}\n\n14 Day Zoom Workplace Free Trial.\n\nAccount ID: ${this.accountID}\nClient ID: ${this.clientID}\nClient Secret: ${this.clientSecret}`)
    }
}

module.exports = Zoom