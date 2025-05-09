import NodeCache from "node-cache"

// TTL = 86400 secondes = 24 heures
export const apiCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 })
