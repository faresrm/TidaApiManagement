import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateApiKey } from '@/lib/api-utils';
import { withCache } from '@/lib/cache-middleware';

export const runtime = 'edge'; // Optionnel : utilise l'edge runtime pour de meilleures performances

export async function GET(request: NextRequest) {
    try {
        // Étape 1 : Valider la clé API
        const apiKeyValidation = await validateApiKey(request);
        if (!apiKeyValidation.valid) {
            return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 });
        }

        const { userId, keyId } = apiKeyValidation;

        // Étape 2 : Récupérer les paramètres de la requête (pagination)
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);

        // Étape 3 : Créer le client Supabase
        const supabase = await createClient();

        // Étape 4 : Récupérer les données des entreprises depuis Supabase
        const { data: companies, error: fetchError, count } = await supabase
            .from('companies')
            .select('*', { count: 'exact' })
            .range((page - 1) * limit, page * limit - 1);

        if (fetchError) {
            console.error('Erreur lors de la récupération des companies:', fetchError);
            return NextResponse.json({ error: 'Erreur lors de la récupération des données' }, { status: 500 });
        }

        if (!companies || companies.length === 0) {
            return NextResponse.json({ message: 'Aucune entreprise trouvée' }, { status: 404 });
        }

        // Étape 5 : Préparer la réponse avec les informations de pagination
        const totalPages = Math.ceil(count! / limit);
        const responseData = {
            companies,
            page,
            totalPages,
            totalCount: count,
        };

        // Étape 6 : Retourner la réponse avec gestion du cache
        return withCache(request, async () => {
            return NextResponse.json(responseData);
        }, {
            duration: 60, // Cache pendant 60 secondes
            varyByQuery: ['page', 'limit'], // Cache varie selon les paramètres page et limit
        }, userId, keyId, '/api/optimized-companies');

    } catch (error) {
        console.error('Erreur inattendue dans GET /api/optimized-companies:', error);
        return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
    }
}