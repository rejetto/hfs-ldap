exports.name = "LDAP authentication"
exports.description = ""
exports.version = 0.1
exports.apiRequired = 1
exports.repo = "rejetto/hfs-ldap"

exports.config = {
    url: { sm: 9, label: "LDAP server URL" },
    checkCert: { sm: 3, type: 'boolean', label: "Check certificate" },
    username: { sm: 6 },
    password: { sm: 6, type: 'password', },
    syncEvery: { sm: 6, type: 'number', unit: 'hours', min: 0, step: 0.1, defaultValue: 1, helperText: "Accepting values less than 1" },
    baseDN: { sm: 6, defaultValue: 'dc=example,dc=com' },
    filter: { defaultValue: '(objectClass=person)' },
}
exports.configDialog = {
    maxWidth: 'sm'
}

exports.init = async api => {
    const _ = api.require('lodash')
    let client
    let connected = Promise.resolve(false)
    const db = await api.openDb('data.kv')
    const timer = setInterval(checkSync, 60_000)
    const unsub = api.subscribeConfig('url', async v => {
        if (!v) return
        if (!v.includes('//'))
            v = 'ldap://' + v
        await close()
        const Client = require('ldapjs-client')
        client = new Client({ url: v, timeout: 5000, tls: { rejectUnauthorized: api.getConfig('checkCert') } })
        connected = client.bind(api.getConfig('username'), api.getConfig('password')).then(() => {
            api.log("connected")
            void checkSync()
            return true
        }, e => {
            api.log("connection failed: " + String(e)) // after getting 'null' as e.message, it's better to print whole e
            return false
        })
    })
    return {
        async unload() {
            clearInterval(timer)
            unsub()
            await close()
        }
    }

    async function close() {
        await client?.unbind()
        await client?.destroy()
    }

    async function checkSync() {
        if (!api.getConfig('url')) return
        if (!await connected) return api.log("not connected")
        if (Date.now() - (db.getSync('lastSync') || 0) < api.getConfig('syncEvery') * 3600_000) return
        api.log("sync started")
        const entries = await client.search(api.getConfig('baseDN'), {
            scope: 'sub',
            attributes: ['uid', 'dn'], // uid for username, dn to ldap.bind
            filter: api.getConfig('filter'),
            sizeLimit: 1000,
        })
        const id = exports.repo
        const added = []
        const conflicts = []
        const removed = []
        for (const e of entries) {
            const { uid, ...rest } = e
            if (!uid) continue
            const account = api.getAccount(uid)
            if (!account) {
                rest.id = id
                rest.isGroup = false
                api.addAccount(uid, { plugin: rest })
                added.push(uid)
            }
            else if (account.plugin?.id !== id)
                conflicts.push(uid)
        }

        for (const [u, a] of Object.entries(api.getHfsConfig('accounts')))
            if (a.plugin?.id === id) // ours
                if (!_.find(entries, { uid: u }) && api.delAccount(u))
                    removed.push(u)
        api.log(`records skipped: ${entries.length - added.length - removed.length - conflicts.length}`)
        if (added.length) api.log(`accounts added: ${added.join(', ')}`)
        if (removed.length) api.log(`accounts removed: ${removed.join(', ')}`)
        if (conflicts.length) api.log(`conflicts found: ${conflicts.join(', ')}`)
        db.put('lastSync', new Date) // human readable
    }
}