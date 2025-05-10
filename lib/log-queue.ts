// File d'attente en mémoire pour les logs d'utilisation
// Cette approche permet de ne pas bloquer les réponses API tout en garantissant
// que les logs sont bien enregistrés

import { createClient } from "@/lib/supabase/server"

// Type pour un log d'utilisation
interface UsageLogEntry {
    userId: string
    keyId: string
    endpoint: string
    status: "success" | "error"
    timestamp: string
}

// Configuration
const BATCH_SIZE = 10 // Nombre de logs à traiter en une seule opération
const FLUSH_INTERVAL = 5000 // Intervalle de vidage de la file d'attente en ms
const MAX_QUEUE_SIZE = 1000 // Taille maximale de la file d'attente

// File d'attente globale
let logQueue: UsageLogEntry[] = []
let isProcessing = false
let flushTimer: NodeJS.Timeout | null = null

// Fonction pour ajouter un log à la file d'attente
export function queueLog(userId: string, keyId: string, endpoint: string, status: "success" | "error"): void {
    // Vérifier si la file d'attente n'est pas trop grande
    if (logQueue.length >= MAX_QUEUE_SIZE) {
        console.warn(`Log queue is full (${logQueue.length} items). Dropping oldest log.`)
        logQueue.shift() // Supprimer le plus ancien log
    }

    // Ajouter le log à la file d'attente
    logQueue.push({
        userId,
        keyId,
        endpoint,
        status,
        timestamp: new Date().toISOString(),
    })

    console.log(`Log queued: ${endpoint} for user ${userId}. Queue size: ${logQueue.length}`)

    // Démarrer le traitement si ce n'est pas déjà en cours
    if (!isProcessing && logQueue.length >= BATCH_SIZE) {
        processQueue()
    }

    // Démarrer le timer de vidage si ce n'est pas déjà en cours
    if (!flushTimer) {
        flushTimer = setTimeout(processQueue, FLUSH_INTERVAL)
    }
}

// Fonction pour traiter la file d'attente
async function processQueue(): Promise<void> {
    // Si la file est vide ou déjà en cours de traitement, ne rien faire
    if (logQueue.length === 0 || isProcessing) {
        return
    }

    // Marquer comme en cours de traitement
    isProcessing = true

    // Réinitialiser le timer
    if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
    }

    try {
        // Prendre un lot de logs
        const batch = logQueue.splice(0, BATCH_SIZE)
        console.log(`Processing ${batch.length} logs from queue. Remaining: ${logQueue.length}`)

        // Créer un client Supabase
        const supabase = await createClient()

        // Insérer le lot
        const { error } = await supabase.from("usage_logs").insert(
            batch.map((log) => ({
                user_id: log.userId,
                api_key_id: log.keyId,
                endpoint: log.endpoint,
                timestamp: log.timestamp,
                status: log.status,
            })),
        )

        if (error) {
            console.error("Error inserting log batch:", error)
            // Remettre les logs dans la file d'attente en cas d'erreur
            logQueue = [...batch, ...logQueue]
        } else {
            console.log(`Successfully inserted ${batch.length} logs`)
        }
    } catch (error) {
        console.error("Error processing log queue:", error)
    } finally {
        // Marquer comme plus en cours de traitement
        isProcessing = false

        // S'il reste des logs, continuer le traitement
        if (logQueue.length > 0) {
            if (logQueue.length >= BATCH_SIZE) {
                // Traiter immédiatement si assez de logs
                processQueue()
            } else {
                // Sinon, démarrer un timer
                flushTimer = setTimeout(processQueue, FLUSH_INTERVAL)
            }
        }
    }
}

// Fonction pour vider la file d'attente (utile pour les tests ou avant la fermeture de l'application)
export async function flushQueue(): Promise<void> {
    if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
    }

    await processQueue()
}

// Démarrer un timer pour vider régulièrement la file d'attente
setInterval(() => {
    if (logQueue.length > 0 && !isProcessing) {
        processQueue()
    }
}, FLUSH_INTERVAL)
