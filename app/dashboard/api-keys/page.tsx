
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiKeysList } from "@/components/api-keys-list"
import { createClient } from "@/lib/supabase/server"
import { CreateApiKeyButton } from "@/components/create-api-key-button"

export default async function ApiKeysPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id

  if (!userId) {
    return <div>Vous devez être connecté pour accéder à cette page.</div>
  }

  const { data: apiKeys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

  const activeKeys = apiKeys?.filter((key) => key.is_active) || []
  const activeKeysCount = activeKeys.length

  return (
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">API Keys</h2>
          <CreateApiKeyButton userId={userId} activeKeysCount={activeKeysCount} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Your API keys</CardTitle>
            <CardDescription>
                You can use your API keys to authenticate requests to the API. To use an API key, include it in the
               <code>?apikey=YOUR_API_KEY</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeysList apiKeys={apiKeys || []} />
          </CardContent>
        </Card>
      </div>
  )
}
