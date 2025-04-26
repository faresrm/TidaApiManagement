-- Création des tables pour la gestion des API avec limitations

-- Table des plans d'abonnement
CREATE TABLE plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  daily_limit INTEGER NOT NULL,
  request_interval INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT
);

-- Table des abonnements utilisateurs
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  plan_id VARCHAR(50) NOT NULL REFERENCES plans(id),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des clés API
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_used TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Table des logs d'utilisation
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  endpoint VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL
);

-- Insertion des plans par défaut
INSERT INTO plans (id, name, daily_limit, request_interval, price, description)
VALUES
  ('free', 'Free', 100, 10, 0, 'Plan de base avec des limitations strictes'),
  ('basic', 'Basic', 1000, 5, 9.99, 'Pour les développeurs individuels'),
  ('pro', 'Professional', 10000, 1, 29.99, 'Pour les équipes et entreprises'),
  ('enterprise', 'Entreprise', 100000, 0, 99.99, 'Pour les grandes entreprises');

-- Création des politiques de sécurité (Row Level Security)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Politiques pour les clés API
CREATE POLICY "Les utilisateurs peuvent voir leurs propres clés API"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent créer leurs propres clés API"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent mettre à jour leurs propres clés API"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id);

-- Politiques pour les abonnements
CREATE POLICY "Les utilisateurs peuvent voir leurs propres abonnements"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Politiques pour les logs d'utilisation
CREATE POLICY "Les utilisateurs peuvent voir leurs propres logs d'utilisation"
  ON usage_logs FOR SELECT
  USING (auth.uid() = user_id);
