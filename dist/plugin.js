exports.name = "LDAP authentication"
exports.description = "Imports users and groups from, and authenticate against an LDAP server"
exports.version = 0.41
exports.apiRequired = 12
exports.repo = "rejetto/hfs-ldap"
exports.preview = "https://github.com/user-attachments/assets/e27c2708-74e5-48c3-b9c9-13526acd9179"
exports.changelog = [
    { "version": 0.4, "message": "Added Limit-users option (before it was a hard limit=1000) and improved error message when the limit is reached" },
    { "version": 0.41, "message": "Updated LDAP component" }
]

exports.config = {
    url: { sm: 9, label: "LDAP server URL" },
    checkCert: { sm: 3, type: 'boolean', label: "Check certificate" },
    username: { sm: 9, label: "Username", helperText: "Bind DN" },
    password: { sm: 3, inputProps: { type: 'password' }, },
    userBaseDN: { sm: 6, label: "Base DN users", defaultValue: 'dc=example,dc=com' },
    userFilter: { sm: 6, defaultValue: '(objectClass=user)' },
    loginField: { xs: 4, placeholder: "automatic" },
    memberField: { xs: 4, defaultValue: 'member' },
    groupField: { xs: 4, defaultValue: 'memberOf' },
    groupBaseDN: { sm: 6, label: "Base DN groups", defaultValue: 'dc=example,dc=com', helperText: "Leave empty to skip groups" },
    groupFilter: { sm: 6, defaultValue: '(objectClass=group)' },
    scope: { xs: 3, type: 'select', defaultValue: 'sub', options: ['base', 'one', 'sub'] },
    syncEvery: { xs: 3, type: 'number', unit: 'hours', min: 0.01, step: 0.01, defaultValue: 0.1, required: true },
    fieldsToStore: { xs: 3, type: 'select', defaultValue: 'dn', options: ['dn', 'all'] },
    limitUsers: { xs: 3, type: 'number', defaultValue: 1000, min: 1, required: true },
}
exports.configDialog = {
    maxWidth: 'sm'
}

exports.init = async api => {
    const { _ } = api
    const db = await api.openDb('data.kv')
    const id = exports.repo
    api.subscribeConfig(['url', 'checkCert', 'username', 'password'], _.debounce(checkConnection))
    api.events.on('clearTextLogin', async req => {
        const a = api.getAccount(req.username)
        if (a?.plugin?.id !== id) return
        const client = await connect(a.plugin.dn, req.password)
        if (!client) return false
        client.destroy()
        return true
    })
    api.setInterval(checkSync, 60_000)
    checkSync()

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
        const next = getNext()
        api.log(`next sync: ${next < Date.now() ? "now" : api.misc.formatTimestamp(next)} (roughly)`)
        return client.bind(u, p).then(() => {
            api.log("connected")
            return client
        }, e => {
            client.destroy()
            api.log("connection failed: " + String(e)) // after getting 'null' as e.message, it's better to print whole e
        })
    }

    function getNext() {
        const last = db.getSync('lastSync')
        return last ? new Date(last.getTime() + api.getConfig('syncEvery') * 3600_000) : 0
    }

    async function checkSync() {
        if (getNext() > Date.now()) return
        const client = await connect()
        if (!client) return
        const storeAll = api.getConfig('fieldsToStore') === 'all'
        try {
            const groupField = api.getConfig('groupField')
            const groupName = 'ldap-group'
            const pluginGroup = _.findKey(api.getHfsConfig('accounts'), x => x.plugin?.id === id && !x.plugin.dn) // group is the only one without dn
                || api.addAccount(groupName, { plugin: { id } }) && groupName

            const gdn = api.getConfig('groupBaseDN')
            let entries = !gdn ? [] : await client.search(gdn, {
                scope: api.getConfig('scope'),
                filter: api.getConfig('groupFilter'),
                sizeLimit: 1000,
            })

            const loginFields = [api.getConfig('loginField'), 'sAMAccountName', 'uid', 'ou', 'cn'] // best to worst

            const added = []
            const conflicts = []
            const removed = []
            const updated = []
            const dn2name = {}
            const group2members = {}
            // import groups
            for (const e of entries) {
                const {dn} = e
                if (!dn) continue // invalid
                const k = _.find(loginFields, k => e[k])
                let u = e[k]
                if (!u) continue
                const account = api.getAccount(u)
                const props = { belongs: [pluginGroup], plugin: { id, dn, ...storeAll && e } }
                if (!account) {
                    const a = await api.addAccount(u, props)
                    added.push(u = a.username)
                }
                else if (account.plugin?.id !== id)
                    conflicts.push(u = account.username)
                else {
                    updated.push(u = account.username)
                    await api.updateAccount(account, props)
                }
                dn2name[dn] = u
                group2members[u] = e[api.getConfig('memberField')]
            }

            // import users
            const udn = api.getConfig('userBaseDN')
            entries = !udn ? [] : await client.search(udn, {
                scope: api.getConfig('scope'),
                filter: api.getConfig('userFilter'),
                sizeLimit: api.getConfig('limitUsers'),
            })
            for (const e of entries) {
                const {dn} = e
                if (!dn) continue // invalid
                const k = _.find(loginFields, k => e[k])
                let u = e[k]
                if (!u) continue
                const account = api.getAccount(u)
                const belongs = api.misc.wantArray(e[groupField]).map(dn => dn2name[dn])
                    .concat(Object.entries(group2members).map(([g, members]) => members?.includes(dn) && g))
                    .filter(Boolean)
                const props = { belongs, plugin: { id, auth: true, dn, ...storeAll && e } }
                if (!account) {
                    const a = await api.addAccount(u, props)
                    added.push(u = a.username)
                }
                else if (account.plugin?.id !== id)
                    conflicts.push(u = account.username)
                else {
                    updated.push(u = account.username)
                    await api.updateAccount(account, props)
                }
            }

            for (const [u, a] of Object.entries(api.getHfsConfig('accounts')))
                if (u !== pluginGroup && a.plugin?.id === id) // ours
                    if (!updated.includes(u) && !added.includes(u) && !conflicts.includes(u))
                        if (api.delAccount(u))
                            removed.push(u)
            api.log(`records updated: ${updated.length}`)
            if (added.length) api.log(`accounts added: ${added.join(', ')}`)
            if (removed.length) api.log(`accounts removed: ${removed.join(', ')}`)
            if (conflicts.length) api.log(`conflicts found: ${conflicts.join(', ')}`)
            db.put('lastSync', new Date) // human-readable
        }
        catch(e) {
            api.log(e.name === 'SizeLimitExceededError' ? "The import got many accounts" : String(e))
        }
        finally {
            client.destroy()
        }
    }
}