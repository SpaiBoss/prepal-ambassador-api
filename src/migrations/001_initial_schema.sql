-- MLM System Initial Schema

-- Ambassadors table
CREATE TABLE IF NOT EXISTS ambassadors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    total_referrals INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    points_balance INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    social_media JSONB DEFAULT '{}',
    joined_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    student_id VARCHAR(100) NOT NULL,
    ambassador_id UUID REFERENCES ambassadors(id) ON DELETE SET NULL,
    ambassador_code VARCHAR(50) NOT NULL,
    subscription_plan VARCHAR(100) NOT NULL,
    subscription_price INTEGER NOT NULL,
    points_awarded INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    registered_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payouts table
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ambassador_id UUID REFERENCES ambassadors(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    points_deducted INTEGER NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('MTN', 'ORANGE')),
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    transaction_reference VARCHAR(255),
    notes TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ambassadors_email ON ambassadors(email);
CREATE INDEX IF NOT EXISTS idx_ambassadors_referral_code ON ambassadors(referral_code);
CREATE INDEX IF NOT EXISTS idx_ambassadors_status ON ambassadors(status);

CREATE INDEX IF NOT EXISTS idx_referrals_ambassador_id ON referrals(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_referrals_student_email ON referrals(student_email);
CREATE INDEX IF NOT EXISTS idx_referrals_registered_at ON referrals(registered_at);
CREATE INDEX IF NOT EXISTS idx_referrals_student_id ON referrals(student_id);

CREATE INDEX IF NOT EXISTS idx_payouts_ambassador_id ON payouts(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at);

-- Insert initial settings
INSERT INTO settings (key, value) VALUES
    ('points_per_referral', '1000'),
    ('max_ambassadors', '50'),
    ('webhook_secret', gen_random_uuid()::text),
    ('system_active', 'true')
ON CONFLICT (key) DO NOTHING;

