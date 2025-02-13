exports.name = "LDAP authentication"
exports.description = ""
exports.version = 0.1
exports.apiRequired = 12
exports.repo = "rejetto/hfs-ldap"

exports.config = {
    url: { sm: 9, label: "LDAP server URL" },
    checkCert: { sm: 3, type: 'boolean', label: "Check certificate" },
    username: { sm: 9, label: "Username", helperText: "Bind DN" },
    password: { sm: 3, inputProps: { type: 'password' }, },
    userFilter: { sm: 9, defaultValue: '(objectClass=person)' },
    loginField: { sm: 3, placeholder: "automatic" },
    baseDN: { sm: 6, label: "Base DN", defaultValue: 'dc=example,dc=com' },
    scope: { sm: 3, type: 'select', defaultValue: 'sub', options: ['base', 'one', 'sub'] },
    syncEvery: { sm: 3, type: 'number', unit: 'hours', min: 0.01, step: 0.01, defaultValue: 0.1, required: true },
}
exports.configDialog = {
    maxWidth: 'sm'
}

exports.init = async api => {
    const _ = api.require('lodash')
    const db = await api.openDb('data.kv')
    const id = exports.repo
    const timer = setInterval(checkSync, 60_000)
    api.subscribeConfig(['url', 'checkCert', 'username', 'password'], checkConnection)
    const undo = api.events.on('clearTextLogin', async req => {
        const a = api.getAccount(req.username)
        if (a?.plugin?.id !== id) return
        const client = await connect(a.plugin.dn, req.password)
        if (!client) return false
        client.destroy()
        return true
    })
    checkSync()
    return {
        async unload() {
            undo()
            clearInterval(timer)
        }
    }

    async function checkConnection() {
        void (await connect())?.destroy()
    }

    async function connect(u=api.getConfig('username'), p=api.getConfig('password')) {
        let url = api.getConfig('url')
        if (!url) return
        if (!url.includes('//'))
            url = 'ldap://' + url
        const Client = require('./ldapjs-client')
        const client = new Client({ url: url, timeout: 5000, tls: { rejectUnauthorized: api.getConfig('checkCert') } })
        const last = db.getSync('lastSync')
        api.log(`next sync: ${!last ? "now" : api.misc.formatTimestamp(new Date(last.getTime() + api.getConfig('syncEvery') * 3600_000))}`)
        return client.bind(u, p).then(() => {
            api.log("connected")
            return client
        }, e => {
            client.destroy()
            api.log("connection failed: " + String(e)) // after getting 'null' as e.message, it's better to print whole e
        })
    }

    async function checkSync() {
        if (Date.now() - (db.getSync('lastSync') || 0) < api.getConfig('syncEvery') * 3600_000) return
        const client = await connect()
        if (!client) return
        try {
            const x = api.getConfig('loginField')
            const loginFields = x ? [x] : ['sAMAccountName', 'uid', 'cn'] // best to worst
            const entries = await client.search(api.getConfig('baseDN'), {
                scope: api.getConfig('scope'),
                filter: api.getConfig('userFilter'),
                sizeLimit: 1000,
            })
            const groupName = 'ldap-group'
            const group = _.findKey(api.getHfsConfig('accounts'), x => x.plugin?.id === id && !x.plugin.dn) // group is the only one without dn
                || api.addAccount(groupName, { plugin: { id } }) && groupName

            const added = []
            const conflicts = []
            const removed = []
            const skipped = []
            for (const e of entries) {
                if (!e.dn) continue // invalid
                const k = _.find(loginFields, k => e[k])
                const u = e[k]
                if (!u) continue
                const account = api.getAccount(u)
                const rest = _.omit(e, loginFields)
                if (!account) {
                    rest.id = id
                    rest.isGroup = false
                    api.addAccount(u, { plugin: rest, belongs: [group] })
                    added.push(u)
                }
                else if (account.plugin?.id !== id)
                    conflicts.push(u)
                else
                    skipped.push(u)
            }

            for (const [u, a] of Object.entries(api.getHfsConfig('accounts')))
                if (u !== group && a.plugin?.id === id) // ours
                    if (!skipped.includes(u) && !added.includes(u) && !conflicts.includes(u))
                        if (api.delAccount(u))
                            removed.push(u)
            api.log(`records skipped: ${skipped.length}`)
            if (added.length) api.log(`accounts added: ${added.join(', ')}`)
            if (removed.length) api.log(`accounts removed: ${removed.join(', ')}`)
            if (conflicts.length) api.log(`conflicts found: ${conflicts.join(', ')}`)
            db.put('lastSync', new Date) // human-readable
        }
        finally {
            client.destroy()
        }
    }
}